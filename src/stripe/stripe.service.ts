import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { TransactionService } from '../transactions/transaction.service';
import { VendorService } from '../vendors/vendor.service';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { CartItemClass } from '../cart/entities/cart.schema';
import { CartService } from '../cart/cart.service';
import { ProductItemService } from '../product-item/product-item.service';
import { TicketService } from '../tickets/ticket.service';
import { PayoutSchemaClass } from '../payout/infrastructure/persistence/document/entities/payout.schema';
import { PayoutStatus } from '../payout/infrastructure/persistence/document/entities/payout.schema';


// Updated interface to match new Stripe types
interface CustomSession extends Omit<Stripe.Checkout.Session, 'client_secret'> {
  client_secret: string | null;
}

// Updated interface for embedded checkout params
interface EmbeddedCheckoutParams extends Omit<Stripe.Checkout.SessionCreateParams, 'success_url' | 'cancel_url'> {
  ui_mode: 'embedded';
  return_url: string;
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    @InjectModel(PayoutSchemaClass.name)
    private payoutModel: Model<PayoutSchemaClass>,
    private configService: ConfigService,
    private transactionService: TransactionService,
    private vendorService: VendorService,
    private cartService: CartService,
    private productItemService: ProductItemService,
    private ticketService: TicketService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
  }
  async createCheckoutSession({
    items,
    customerId,
    returnUrl,
  }: {
    items: CartItemClass[];
    customerId: string;
    returnUrl: string;
  }) {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Invalid or empty items array');
      }

      await this.cartService.setCheckoutStatus(customerId, true);

      const totalAmount = items.reduce((sum, item) => {
        const itemPrice = Number(item.price) || 0;
        const itemQuantity = Number(item.quantity) || 0;
        return sum + Math.round(itemPrice * itemQuantity * 100);
      }, 0);

      if (totalAmount <= 0) {
        throw new Error('Invalid total amount');
      }

      
      const compactItemsMetadata = items.map(item => ({
        id: item.productItemId,
        q: item.quantity,
        d: new Date(item.productDate).toISOString().split('T')[0],
        t: item.productStartTime
      }));

      const sessionParams: EmbeddedCheckoutParams = {
        ui_mode: 'embedded',
        return_url: returnUrl,
        line_items: items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.productName,
              metadata: {
                id: item.productItemId,
                date: new Date(item.productDate).toISOString().split('T')[0],
                time: item.productStartTime
              }
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        metadata: {
          customerId,
          items: JSON.stringify(compactItemsMetadata)
        },
        payment_intent_data: {
          metadata: {
            customerId
          },
        },
      };

      const session = await this.stripe.checkout.sessions.create(
        sessionParams as Stripe.Checkout.SessionCreateParams
      );

      await this.transactionService.create({
        stripeCheckoutSessionId: session.id,
        amount: totalAmount,
        currency: 'usd',
        customerId,
        productItemIds: items.map(item => item.productItemId),
        description: `Payment for ${items.length} item(s)`,
        metadata: {
          items: JSON.stringify(items),
          returnUrl,
        },
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT,
      });

      // Cast the session to our custom type that includes client_secret
      const sessionWithSecret = session as unknown as CustomSession;
      return {
        clientSecret: sessionWithSecret.client_secret || '',
      };
    } catch (error) {
      await this.cartService.setCheckoutStatus(customerId, false);
      
      console.error('Error creating checkout session:', error);
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Failed to create checkout session',
      );
    }
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
        
      case 'charge.refunded':
        // Extract payment_intent directly from the webhook data
        const refundObject = event.data.object;
        if (refundObject && refundObject.payment_intent) {
          await this.handleRefund(refundObject.payment_intent, refundObject);
          console.log(`Processing refund for payment intent: ${refundObject.payment_intent}`);
        } else {
          console.error('Missing payment_intent in charge.refunded webhook:', JSON.stringify(refundObject));
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

private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  try {
    // Extract payment_intent directly from the session object
    const paymentIntentId = session.payment_intent as string;
    if (!paymentIntentId) {
      console.error('Missing payment intent ID in checkout session:', JSON.stringify(session));
      throw new Error('Missing payment intent ID in checkout session');
    }

    console.log(`Storing payment intent ID ${paymentIntentId} for checkout session ${session.id}`);
    
    // Store the payment intent ID during checkout completion
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
      const items = JSON.parse(session.metadata.items) as Array<{
        id: string;
        q: number;
        d: string;
        t: string;
      }>;
  
      for (const item of items) {
        const productItem = await this.productItemService.findById(item.id);
        if (!productItem?.data) {
          console.error(`Product item ${item.id} not found`);
          continue;
        }
  
        try {
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
              productLocation: productItem.data.location,
              productImageURL: productItem.data.imageURL,
              productAdditionalInfo: productItem.data.additionalInfo,
              productRequirements: productItem.data.requirements,
              productWaiver: productItem.data.waiver,
              quantity: 1,
            });
          }
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
        }
      }
  
      await this.cartService.deleteCart(customerId);
  
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

      await this.cartService.setCheckoutStatus(session.metadata.customerId, false);
    } catch (error) {
      console.error('Error handling expired checkout session:', error);
      throw error;
    }
  }
  
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    if (paymentIntent.metadata?.customerId) {
      await this.cartService.setCheckoutStatus(paymentIntent.metadata.customerId, false);
    }

    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.FAILED,
      {
        error: paymentIntent.last_payment_error?.message,
      },
    );
  }

  private async handleRefund(paymentIntentId: string, refundData: any) {
    try {
      console.log(`Processing refund for payment intent: ${paymentIntentId}`);
      
      // Find transaction by payment intent ID
      const transaction = await this.transactionService.findByPaymentIntentId(paymentIntentId);
      
      if (!transaction) {
        console.error(`Transaction not found for payment intent ID: ${paymentIntentId}`);
        return;
      }
      
      // Extract refund details from the refund data
      const refundAmount = refundData.amount_refunded || 0;
      let refundId, refundReason;
      
      if (refundData.refunds && refundData.refunds.data && refundData.refunds.data.length > 0) {
        refundId = refundData.refunds.data[0].id;
        refundReason = refundData.refunds.data[0].reason;
      }
      
      // Update transaction status
      await this.transactionService.updateTransactionStatusByPaymentIntentId(
        paymentIntentId,
        TransactionStatus.REFUNDED,
        {
          refundId,
          refundAmount,
          refundReason,
        },
      );
      
      // Update tickets if transaction has checkout session ID
      if (transaction.stripeCheckoutSessionId) {
        await this.ticketService.updateTicketsForRefundedTransaction(
          transaction.stripeCheckoutSessionId
        );
        console.log(`Updated tickets for checkout session: ${transaction.stripeCheckoutSessionId}`);
      } else {
        console.error(
          `No checkout session ID found for transaction with payment intent ${paymentIntentId}`
        );
      }
      
      console.log(`Successfully processed refund for payment intent ${paymentIntentId}`);
    } catch (error) {
      console.error(`Error processing refund for payment intent ${paymentIntentId}:`, error);
    }
  }

  async issueTicketRefund(ticketId: string): Promise<any> {
    try {
      // Get the ticket
      const ticket = await this.ticketService.findById(ticketId);
      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }
  
      // Get the transaction using transactionId from the ticket
      let transaction;
      try {
        // Try to get it directly first
        transaction = await this.transactionService.findByCheckoutSessionId(ticket.transactionId);
      } catch (error) {
        // If not found directly, try with findById which returns {data: transaction}
        const transactionResponse = await this.transactionService.findById(ticket.transactionId);
        transaction = transactionResponse.data;
      }
  
      if (!transaction) {
        throw new NotFoundException(`Transaction for ticket ${ticketId} not found`);
      }
  
      // Ensure we have a payment intent ID
      if (!transaction.paymentIntentId) {
        throw new BadRequestException(
          `No payment intent ID found for transaction ${ticket.transactionId}`
        );
      }
  
      // Calculate the amount to refund (ticket price in cents)
      const refundAmount = Math.round(ticket.productPrice * 100);
  
      // Issue the refund through Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: transaction.paymentIntentId,
        amount: refundAmount,
        metadata: {
          ticketId: ticketId,
          transactionId: transaction._id.toString()
        }
      });
  
      console.log(`Refund initiated for ticket ${ticketId}, amount: ${refundAmount / 100}`);
      return refund;
    } catch (error) {
      console.error(`Error issuing refund for ticket ${ticketId}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process ticket refund');
    }
  }


  async issueTransactionRefund(transactionId: string): Promise<any> {
    try {
      // Get the transaction
      const transactionResponse = await this.transactionService.findById(transactionId);
      const transaction = transactionResponse.data;
      
      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${transactionId} not found`);
      }
  
      // Ensure we have a payment intent ID
      if (!transaction.paymentIntentId) {
        throw new BadRequestException(
          `No payment intent ID found for transaction ${transactionId}`
        );
      }
  
      // Issue a full refund through Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: transaction.paymentIntentId,
        metadata: {
          transactionId: transactionId
        }
      });
  
      console.log(`Full refund initiated for transaction ${transactionId}`);
      return refund;
    } catch (error) {
      console.error(`Error issuing refund for transaction ${transactionId}:`, error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process transaction refund');
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

  async getSessionStatus(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        status: session.status,
        customer_email: session.customer_details?.email,
      };
    } catch (error) {
      console.error('Error retrieving session status:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve session status',
      );
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
          'stripeTransferDetails.destinationPayment': transfer.destination_payment,
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
}