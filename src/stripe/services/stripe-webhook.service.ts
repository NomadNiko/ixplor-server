import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { TransactionService } from '../../transactions/transaction.service';
import { VendorService } from '../../vendors/vendor.service';
import { CartService } from '../../cart/cart.service';
import { ProductItemService } from '../../product-item/product-item.service';
import { TicketService } from '../../tickets/ticket.service';
import {
  CheckoutData,
  TransactionStatus,
} from '../../transactions/infrastructure/persistence/document/entities/transaction.schema';
import {
  PayoutSchemaClass,
  PayoutStatus,
} from '../../payout/infrastructure/persistence/document/entities/payout.schema';
import { TicketStatus } from '../../tickets/infrastructure/persistence/document/entities/ticket.schema';
import { UsersService } from '../../users/users.service';
import { MailService } from '../../mail/mail.service';
import { BookingItemService } from '../../booking-item/booking-item.service';
import { VendorSchemaClass } from '../../vendors/infrastructure/persistence/document/entities/vendor.schema';

@Injectable()
export class StripeWebhookService {
  private stripe: Stripe;
  
  constructor(
    @InjectModel(PayoutSchemaClass.name)
    private payoutModel: Model<PayoutSchemaClass>,
    @InjectModel(VendorSchemaClass.name)
    private vendorModel: Model<VendorSchemaClass>,
    private configService: ConfigService,
    private transactionService: TransactionService,
    private vendorService: VendorService,
    private cartService: CartService,
    private productItemService: ProductItemService,
    private bookingItemService: BookingItemService,
    private ticketService: TicketService,
    private userService: UsersService,
    private mailService: MailService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ??
        '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
  }
  

  async handleWebhookEvent(signature: string, payload: any) {
    try {
      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
      console.log('Processing webhook event type:', event.type);
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case 'transfer.created':
          await this.handleTransferCreated(
            event.data.object as Stripe.Transfer,
          );
          break;
        case 'charge.succeeded':
          await this.handleChargeSucceeded(event.data.object as Stripe.Charge);
          break;
        case 'charge.refunded':
          const refundObject = event.data.object;
          const chargeObject = event.data.object;
          if (refundObject && chargeObject.payment_intent) {
            await this.handleRefund(refundObject, chargeObject);
            console.log(
              `Processing refund for payment intent: ${chargeObject.payment_intent}`,
            );
          } else {
            console.error(
              'Missing payment_intent in charge.refunded webhook:',
              JSON.stringify(refundObject),
            );
          }
          break;
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;
      }
      return { received: true };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new InternalServerErrorException('Webhook handling failed');
    }
  }

  async handleTransferCreated(transfer: Stripe.Transfer) {
    try {
      const payout = await this.payoutModel.findOne({
        'stripeTransferDetails.transferId': transfer.id,
      });
      if (!payout) {
        console.error(`No payout record found for transfer ID: ${transfer.id}`);
        return;
      }
      const updatedPayout = await this.payoutModel.findByIdAndUpdate(
        payout._id,
        {
          status: PayoutStatus.SUCCEEDED,
          'stripeTransferDetails.destinationPayment':
            transfer.destination_payment,
          processedAt: new Date(transfer.created * 1000),
          updatedAt: new Date(),
        },
        { new: true },
      );
      console.log(
        `Payout ${payout._id} updated to SUCCEEDED status for transfer ${transfer.id}`,
      );
      return updatedPayout;
    } catch (error) {
      console.error('Error handling transfer.created webhook:', error);
      throw new InternalServerErrorException(
        'Failed to process transfer webhook',
      );
    }
  }
  
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    try {
      const paymentIntentId = session.payment_intent as string;
      if (!paymentIntentId) {
        console.error(
          'Missing payment intent ID in checkout session:',
          JSON.stringify(session),
        );
        throw new Error('Missing payment intent ID in checkout session');
      }
  
      console.log(
        `Storing payment intent ID ${paymentIntentId} for checkout session ${session.id}`,
      );
  
      await this.transactionService.updateTransactionStatus(
        session.id,
        TransactionStatus.SUCCEEDED,
        {
          receiptEmail: session.customer_email || undefined,
          paymentIntentId: paymentIntentId,
        },
      );
  
      if (!session.metadata?.customerId || !session.metadata?.items) {
        throw new Error('Missing required metadata in checkout session');
      }
  
      const customerId = session.metadata.customerId;
      
      // Parse the items from metadata
      const items = JSON.parse(session.metadata.items);
      
      console.log('Processing checkout items:', JSON.stringify(items));
      
      for (const item of items) {
        try {
          // Check if this is a booking item or a product item based on type field
          const isBookingItem = item.type === 'booking';
          
          if (isBookingItem) {
            // Process as a booking item
            console.log(`Processing booking item ${item.id}`);
            const bookingItem = await this.bookingItemService.findById(item.id);
            
            if (!bookingItem?.data) {
              console.error(`Booking item ${item.id} not found`);
              continue;
            }
            
            // Fetch vendor to get location coordinates
            const vendor = await this.vendorModel.findById(bookingItem.data.vendorId)
              .select('latitude longitude')
              .lean();
            
            // Prepare location using vendor coordinates
            let productLocation = {
              type: 'Point',
              coordinates: [0, 0] // Default fallback
            };
            
            if (vendor && typeof vendor.longitude === 'number' && typeof vendor.latitude === 'number') {
              productLocation = {
                type: 'Point',
                coordinates: [vendor.longitude, vendor.latitude]
              };
            }
            
            for (let i = 0; i < item.q; i++) {
              await this.ticketService.createTicket({
                userId: customerId,
                transactionId: session.id,
                vendorId: bookingItem.data.vendorId,
                productItemId: item.id,
                productName: bookingItem.data.productName,
                productDescription: bookingItem.data.description,
                productPrice: bookingItem.data.price,
                productType: 'booking', // Mark as booking type
                productDate: new Date(item.d),
                productStartTime: item.t,
                productDuration: bookingItem.data.duration,
                productLocation: productLocation, // Use vendor location
                productImageURL: bookingItem.data.imageURL || '',
                productAdditionalInfo: bookingItem.data.additionalInfo || '',
                productRequirements: [], // Booking items might not have requirements like products
                productWaiver: '', // Assign appropriate waiver if available
                quantity: 1,
                vendorOwed: (bookingItem.data.price * 0.85) // Assuming 15% platform fee
              });
              console.log(`Created ticket for booking item ${item.id}`);
            }
          } else {
            // Process as a product item (original behavior)
            console.log(`Processing product item ${item.id}`);
            const productItem = await this.productItemService.findById(item.id);
            
            if (!productItem?.data) {
              console.error(`Product item ${item.id} not found`);
              continue;
            }
            
            // Validate product location
            let productLocation = productItem.data.location;
            
            // If location is missing or has invalid coordinates, create a valid one
            if (!productLocation || 
                !productLocation.coordinates || 
                !Array.isArray(productLocation.coordinates) ||
                typeof productLocation.coordinates[0] !== 'number' ||
                typeof productLocation.coordinates[1] !== 'number') {
              
              // Try to get vendor location as fallback
              const vendor = await this.vendorModel.findById(productItem.data.vendorId)
                .select('latitude longitude')
                .lean();
                
              if (vendor && typeof vendor.longitude === 'number' && typeof vendor.latitude === 'number') {
                productLocation = {
                  type: 'Point',
                  coordinates: [vendor.longitude, vendor.latitude]
                };
              } else {
                // Last resort fallback
                productLocation = {
                  type: 'Point',
                  coordinates: [0, 0]
                };
              }
            }
            
            for (let i = 0; i < item.q; i++) {
              await this.ticketService.createTicket({
                userId: customerId,
                transactionId: session.id,
                vendorId: productItem.data.vendorId,
                productItemId: item.id,
                productName: productItem.data.templateName,
                productDescription: productItem.data.description,
                productPrice: productItem.data.price,
                productType: productItem.data.productType,
                productDate: new Date(item.d),
                productStartTime: item.t,
                productDuration: productItem.data.duration,
                productLocation: productLocation,
                productImageURL: productItem.data.imageURL || '',
                productAdditionalInfo: productItem.data.additionalInfo || '',
                productRequirements: productItem.data.requirements || [],
                productWaiver: productItem.data.waiver || '',
                quantity: 1,
                vendorOwed: (productItem.data.price * 0.85) // Assuming 15% platform fee
              });
              console.log(`Created ticket for product item ${item.id}`);
            }
          }
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          // Continue with other items even if one fails
        }
      }
      
      // Clean up the cart after successful processing
      await this.cartService.deleteCart(customerId);
      console.log(`Checkout completed successfully for customer ${customerId}`);
    } catch (error) {
      console.error('Error processing successful checkout:', error);
      throw error;
    }
  }

  private async handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
    try {
      if (!session.metadata?.customerId) {
        throw new Error('Missing customer ID in session metadata');
      }

      await this.cartService.setCheckoutStatus(
        session.metadata.customerId,
        false,
      );
    } catch (error) {
      console.error('Error handling expired checkout session:', error);
      throw error;
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    if (paymentIntent.metadata?.customerId) {
      await this.cartService.setCheckoutStatus(
        paymentIntent.metadata.customerId,
        false,
      );
    }

    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.FAILED,
      {
        error: paymentIntent.last_payment_error?.message,
      },
    );
  }

  private async handleRefund(refundObject: any, chargeObject: any) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    try {
      if (!chargeObject.payment_intent) {
        console.warn('Refund webhook received without payment_intent ID');
        return;
      }

      const paymentIntentId =
        typeof chargeObject.payment_intent === 'string'
          ? chargeObject.payment_intent
          : chargeObject.payment_intent.id;

      const transaction = await this.transactionService.findByPaymentIntentId(
        paymentIntentId,
      );
      if (!transaction) {
        console.warn(
          `No transaction found for payment intent: ${paymentIntentId}`,
        );
        return;
      }

      const user = await this.userService.findById(
        transaction.customerId as string,
      );
      if (!user) {
        console.warn(
          `User not found for customer ID: ${transaction.customerId}`,
        );
        return;
      }

      const tickets = await this.ticketService.findByTransactionId(
        transaction.stripeCheckoutSessionId as string,
      );
      if (!tickets || tickets.length === 0) {
        console.warn(
          `No tickets found for transaction: ${transaction.stripeCheckoutSessionId}`,
        );
        return;
      }

      const productItems = tickets.map((ticket) => ({
        productName: ticket.productName,
        quantity: ticket.quantity,
        price: ticket.productPrice,
        date: ticket.productDate
          ? new Date(ticket.productDate).toLocaleDateString()
          : undefined,
        time: ticket.productStartTime,
      }));

      await this.mailService.sendRefundReceipt({
        to: user.email as string,
        data: {
          userName:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
            'Valued Customer',
          transactionId: transaction._id.toString(),
          amount: transaction.amount,
          purchaseDate: new Date().toLocaleDateString(),
          productItems,
          stripeReceiptUrl: chargeObject.receipt_url,
        },
      });

      console.log(
        `Refund receipt email sent to ${user.email} for transaction ${transaction._id}`,
      );
    } catch (error) {
      console.error('Error handling refund webhook:', error);
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute) {
    await this.transactionService.updateTransactionStatus(
      dispute.payment_intent as string,
      TransactionStatus.DISPUTED,
      {
        disputeId: dispute.id,
        disputeStatus: dispute.status,
        disputeAmount: dispute.amount,
      },
    );
  }

  private async handleChargeSucceeded(charge: Stripe.Charge) {
    // Wait 10 seconds to give Stripe time to finish checkout and send the next Webhook
    await new Promise((resolve) => setTimeout(resolve, 10000));
    try {
      if (!charge.payment_intent) {
        console.warn(
          'Charge succeeded webhook received without payment_intent ID',
        );
        return;
      }

      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent.id;

      console.log(
        `Processing charge.succeeded for payment intent: ${paymentIntentId}`,
      );

      const transaction = await this.transactionService.findByPaymentIntentId(
        paymentIntentId,
      );

      if (!transaction) {
        console.warn(
          `No transaction found for payment intent: ${paymentIntentId}`,
        );
        return;
      }

      // Extract checkout data from charge with proper null handling
      const checkoutData: CheckoutData = {
        chargeId: charge.id,
        amount: charge.amount,
        amount_captured: charge.amount_captured,
        amount_refunded: charge.amount_refunded,
        billing_details: {
          address: charge.billing_details?.address || null,
          email: charge.billing_details?.email,
          name: charge.billing_details?.name,
          phone: charge.billing_details?.phone,
        },
        captured: charge.captured,
        created: charge.created,
        currency: charge.currency,
        paid: charge.paid,
        payment_intent: paymentIntentId,
        payment_method:
          typeof charge.payment_method === 'string'
            ? charge.payment_method
            : 'unknown',
        receipt_email: charge.receipt_email,
        receipt_url: charge.receipt_url,
      };

      // Update transaction with checkout data
      await this.transactionService.updateTransactionStatusByPaymentIntentId(
        paymentIntentId,
        TransactionStatus.SUCCEEDED,
        {
          checkoutData,
          receiptEmail: charge.receipt_email || undefined,
        },
      );

      console.log(
        `Successfully updated transaction with checkout data for payment intent: ${paymentIntentId}`,
      );

      // Send receipt email to customer
      try {
        // Get the user's information from our system
        if (transaction.customerId) {
          const user = await this.userService.findById(transaction.customerId);
          if (!user) {
            console.warn(
              `User not found for customer ID: ${transaction.customerId}`,
            );
            return;
          }

          // Get the tickets/items associated with this transaction
          const tickets = await this.ticketService.findByTransactionId(
            transaction.stripeCheckoutSessionId as string,
          );

          if (!tickets || tickets.length === 0) {
            console.warn(
              `No tickets found for transaction: ${transaction.stripeCheckoutSessionId}`,
            );
            return;
          }

          // Prepare product items for email
          const productItems = tickets.map((ticket) => ({
            productName: ticket.productName,
            quantity: ticket.quantity,
            price: ticket.productPrice,
            date: ticket.productDate
              ? new Date(ticket.productDate).toLocaleDateString()
              : undefined,
            time: ticket.productStartTime,
          }));

          // Send receipt email using our mail service
          await this.mailService.sendTransactionReceipt({
            to: user.email as string,
            data: {
              userName:
                `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                'Valued Customer',
              transactionId: transaction._id.toString(),
              amount: transaction.amount,
              purchaseDate: new Date().toLocaleDateString(),
              productItems,
              stripeReceiptUrl: checkoutData.receipt_url as string,
            },
          });

          console.log(
            `Receipt email sent to ${user.email} for transaction ${transaction._id}`,
          );
        }
      } catch (emailError) {
        // Log error but don't fail the overall process
        console.error('Error sending receipt email:', emailError);
      }
    } catch (error) {
      console.error('Error handling charge.succeeded webhook:', error);
      throw error;
    }
  }
}
