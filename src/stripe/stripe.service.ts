import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TransactionService } from '../transactions/transaction.service';
import { VendorService } from '../vendors/vendor.service';
import { 
  TransactionStatus, 
  TransactionType 
} from '../transactions/infrastructure/persistence/document/entities/transaction.schema';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private transactionService: TransactionService,
    private vendorService: VendorService
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
      {
        apiVersion: '2023-08-16',
      }
    );
  }

  async createPaymentIntent({
    amount,
    currency,
    vendorId,
    customerId,
    productId,
    description,
    metadata
  }: {
    amount: number;
    currency: string;
    vendorId: string;
    customerId: string;
    productId: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const vendor = await this.vendorService.getStripeStatus(vendorId);
      if (!vendor?.data?.stripeConnectId) {
        throw new Error('Vendor not configured for payments');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        description,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      await this.transactionService.create({
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency,
        vendorId,
        customerId,
        productId,
        description,
        metadata,
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT
      });

      return {
        clientSecret: paymentIntent.client_secret
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  async handleWebhookEvent(signature: string, payload: Buffer) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET', { infer: true }) ?? ''
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.processing':
          await this.handlePaymentIntentProcessing(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
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

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const latestCharge = await this.stripe.charges.retrieve(paymentIntent.latest_charge as string);
    
    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.SUCCEEDED,
      {
        paymentMethodDetails: latestCharge.payment_method_details,
        receiptEmail: paymentIntent.receipt_email || undefined
      }
    );
  }

  private async handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent) {
    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.PROCESSING
    );
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.FAILED,
      {
        error: paymentIntent.last_payment_error?.message
      }
    );
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    if (charge.payment_intent) {
      await this.transactionService.updateTransactionStatus(
        typeof charge.payment_intent === 'string' 
          ? charge.payment_intent 
          : charge.payment_intent.id,
        charge.amount_refunded === charge.amount 
          ? TransactionStatus.REFUNDED 
          : TransactionStatus.PARTIALLY_REFUNDED,
        {
          refundId: charge.refunds?.data[0]?.id,
          refundAmount: charge.amount_refunded,
          refundReason: charge.refunds?.data[0]?.reason || undefined
        }
      );
    }
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute) {
    if (dispute.payment_intent) {
      await this.transactionService.updateTransactionStatus(
        typeof dispute.payment_intent === 'string'
          ? dispute.payment_intent
          : dispute.payment_intent.id,
        TransactionStatus.DISPUTED,
        {
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeAmount: dispute.amount
        }
      );
    }
  }
}