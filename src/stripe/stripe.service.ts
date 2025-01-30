import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TransactionService } from '../transactions/transaction.service';
import { VendorService } from '../vendors/vendor.service';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { CartItemClass } from 'src/cart/entities/cart.schema';
import { CartService } from 'src/cart/cart.service';
import { ProductService } from 'src/products/product.service';
import { TicketService } from 'src/tickets/ticket.service';

interface StripeSessionWithClientSecret extends Stripe.Checkout.Session {
  client_secret?: string;
}

interface ExtendedSessionCreateParams extends Stripe.Checkout.SessionCreateParams {
  ui_mode?: 'hosted' | 'embedded';
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private transactionService: TransactionService,
    private vendorService: VendorService,
    private cartService: CartService,
    private productService: ProductService,
    private ticketService: TicketService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ??
        '',
      {
        apiVersion: '2023-08-16',
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
        return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        line_items: items.map((item) => ({
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
        metadata: {
          customerId,
          vendorId: firstItem.vendorId,
          items: JSON.stringify(
            items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              productName: item.productName,
              productDate: item.productDate,
              productStartTime: item.productStartTime,
            })),
          ),
        },
        payment_intent_data: {
          metadata: {
            customerId,
            vendorId: firstItem.vendorId
          }
        }
      } as unknown as ExtendedSessionCreateParams);

      // Create initial transaction record
      await this.transactionService.create({
        stripeCheckoutSessionId: session.id,
        amount: totalAmount,
        currency: 'usd',
        vendorId: firstItem.vendorId,
        customerId,
        productId: firstItem.productId,
        description: `Payment for ${items.length} item(s)`,
        metadata: {
          items: session.metadata?.items,
          returnUrl,
        },
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT,
      });

      return {
        clientSecret: (session as StripeSessionWithClientSecret).client_secret ?? '',
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to create checkout session',
      );
    }
  }

  async handleWebhookEvent(signature: string, payload: any) {
    try {
      // Skip signature verification and directly process the event
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
            event.data.object as Stripe.PaymentIntent
          );
          break;

        case 'charge.refunded':
          await this.handleRefund(
            event.data.object as Stripe.Charge
          );
          break;

        case 'charge.dispute.created':
          await this.handleDisputeCreated(
            event.data.object as Stripe.Dispute
          );
          break;
      }

      return { received: true };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new InternalServerErrorException('Webhook handling failed');
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    try {
      // Update transaction status
      await this.transactionService.updateTransactionStatus(
        session.id,
        TransactionStatus.SUCCEEDED,
        {
          receiptEmail: session.customer_email || undefined,
        },
      );
  
      if (session.metadata?.customerId && session.metadata?.items) {
        const items = JSON.parse(session.metadata.items);
        const customerId = session.metadata.customerId;
  
        // Create tickets for each item
        for (const item of items) {
          const product = await this.productService.findById(item.productId);
          if (product?.data) {
            await this.ticketService.createTicket({
              userId: customerId,
              transactionId: session.id,
              vendorId: product.data.vendorId,
              productId: item.productId,
              productName: product.data.productName,
              productDescription: product.data.productDescription,
              productPrice: product.data.productPrice,
              productType: product.data.productType,
              productDate: item.productDate,
              productStartTime: item.productStartTime,
              productDuration: product.data.productDuration,
              productLocation: product.data.location,
              productImageURL: product.data.productImageURL,
              productAdditionalInfo: product.data.productAdditionalInfo,
              productRequirements: product.data.productRequirements,
              productWaiver: product.data.productWaiver,
              quantity: item.quantity,
            });
          }
        }
  
        // Delete the cart
        await this.cartService.deleteCart(customerId);
      }
    } catch (error) {
      console.error('Error processing successful checkout:', error);
      throw error;
    }
  }

  private async handlePaymentFailed(
    paymentIntent: Stripe.PaymentIntent
  ) {
    await this.transactionService.updateTransactionStatus(
      paymentIntent.id,
      TransactionStatus.FAILED,
      {
        error: paymentIntent.last_payment_error?.message
      }
    );
  }

  private async handleRefund(
    charge: Stripe.Charge
  ) {
    if (charge.refunds?.data?.[0]) {
      const refund = charge.refunds.data[0];
      await this.transactionService.updateTransactionStatus(
        charge.payment_intent as string,
        TransactionStatus.REFUNDED,
        {
          refundId: refund.id,
          refundAmount: refund.amount,
          refundReason: refund.reason || undefined
        }
      );
    }
  }

  private async handleDisputeCreated(
    dispute: Stripe.Dispute
  ) {
    await this.transactionService.updateTransactionStatus(
      dispute.payment_intent as string,
      TransactionStatus.DISPUTED,
      {
        disputeId: dispute.id,
        disputeStatus: dispute.status,
        disputeAmount: dispute.amount
      }
    );
  }

  async getSessionStatus(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        status: session.status,
        customer_email: session.customer_details?.email
      };
    } catch (error) {
      console.error('Error retrieving session status:', error);
      throw new InternalServerErrorException('Failed to retrieve session status');
    }
  }
}