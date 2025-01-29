import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TransactionService } from '../transactions/transaction.service';
import { VendorService } from '../vendors/vendor.service';
import { 
  TransactionStatus, 
  TransactionType 
} from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { CartItemClass } from 'src/cart/entities/cart.schema';

interface StripeSessionWithClientSecret extends Stripe.Checkout.Session {
  client_secret?: string;
}

interface ExtendedSessionCreateParams extends Stripe.Checkout.SessionCreateParams {
  ui_mode?: 'hosted' | 'embedded';
  return_url?: string;
}

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

  async createCheckoutSession({
    items,
    customerId,
    returnUrl
  }: {
    items: CartItemClass[];
    customerId: string;
    returnUrl: string;
  }) {
    try {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Invalid or empty items array');
      }

      const totalAmount = items.reduce((sum, item) => {
        const itemPrice = Number(item.price) || 0;
        const itemQuantity = Number(item.quantity) || 0;
        return sum + Math.round(itemPrice * itemQuantity * 100);
      }, 0);

      if (totalAmount <= 0) {
        throw new Error('Invalid total amount');
      }

      const firstItem = items[0];
      if (!firstItem.vendorId) {
        throw new Error('Vendor ID is required');
      }

      const vendor = await this.vendorService.getStripeStatus(firstItem.vendorId);
      if (!vendor?.data?.stripeConnectId) {
        throw new Error('Vendor not configured for payments');
      }

      const session = await this.stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        line_items: items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.productName,
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        return_url: returnUrl,
        metadata: {
          customerId,
          vendorId: firstItem.vendorId,
          items: JSON.stringify(items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            productName: item.productName,
            productDate: item.productDate,
            productStartTime: item.productStartTime
          })))
        }
      } as unknown as Stripe.Checkout.SessionCreateParams);

      await this.transactionService.create({
        stripePaymentIntentId: session.id,
        amount: totalAmount,
        currency: 'usd',
        vendorId: firstItem.vendorId,
        customerId,
        productId: firstItem.productId,
        description: `Payment for ${items.length} item(s)`,
        metadata: {
          items: session.metadata?.items,
          returnUrl
        },
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT
      });

      return { 
        clientSecret: (session as StripeSessionWithClientSecret).client_secret ?? ''  
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to create checkout session'
      );
    }
  }

  // Keep the existing webhook methods, but update to handle checkout session events
  async handleWebhookEvent(signature: string, payload: Buffer) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET', { infer: true }) ?? ''
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        // Other existing methods can remain the same
      }

      return { received: true };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new InternalServerErrorException('Webhook handling failed');
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    await this.transactionService.updateTransactionStatus(
      session.id,
      TransactionStatus.SUCCEEDED,
      {
        receiptEmail: session.customer_email || undefined
      }
    );
  }
}