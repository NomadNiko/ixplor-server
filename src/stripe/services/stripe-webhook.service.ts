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
import { TransactionStatus } from '../../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { PayoutSchemaClass, PayoutStatus } from '../../payout/infrastructure/persistence/document/entities/payout.schema';
import { TicketStatus } from '../../tickets/infrastructure/persistence/document/entities/ticket.schema';

@Injectable()
export class StripeWebhookService {
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

  private handleRefund(paymentIntentId: string, refundData: any) {
    try {
      // Just log the successful refund
      console.log(`Received successful refund confirmation for payment intent: ${paymentIntentId}`);
      console.log(`Refund amount: ${refundData.amount_refunded/100}`);
      
      // No status changes or ticket cancellations - everything was handled proactively
    } catch (error) {
      console.error(`Error logging refund for payment intent ${paymentIntentId}:`, error);
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
}