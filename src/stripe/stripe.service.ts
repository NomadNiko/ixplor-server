// src/stripe/stripe.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PayoutSchemaClass } from '../payout/infrastructure/persistence/document/entities/payout.schema';
import { TransactionService } from '../transactions/transaction.service';
import { VendorService } from '../vendors/vendor.service';
import { CartService } from '../cart/cart.service';
import { ProductItemService } from '../product-item/product-item.service';
import { TicketService } from '../tickets/ticket.service';
import { StripeCheckoutService } from './services/stripe-checkout.service';
import { StripeWebhookService } from './services/stripe-webhook.service';
import { StripeRefundService } from './services/stripe-refund.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private stripeCheckoutService: StripeCheckoutService;
  private stripeWebhookService: StripeWebhookService;
  private stripeRefundService: StripeRefundService;
  
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
    private ticketService: TicketService,
    private userService: UsersService,
    private mailService: MailService,
    private bookingItemService: BookingItemService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
    
    this.stripeCheckoutService = new StripeCheckoutService(
      configService,
      cartService,
      transactionService
    );
    
    this.stripeWebhookService = new StripeWebhookService(
      payoutModel,
      vendorModel,
      configService,
      transactionService,
      vendorService,
      cartService,
      productItemService,
      bookingItemService,
      ticketService,
      userService,
      mailService
    );
    
    this.stripeRefundService = new StripeRefundService(
      configService,
      transactionService,
      vendorService,
      ticketService
    );
  }

  async createCheckoutSession(params: {
    items: any[];
    customerId: string;
    returnUrl: string;
  }) {
    return this.stripeCheckoutService.createCheckoutSession(params);
  }

  async getSessionStatus(sessionId: string) {
    return this.stripeCheckoutService.getSessionStatus(sessionId);
  }

  async handleWebhookEvent(signature: string, payload: any) {
    return this.stripeWebhookService.handleWebhookEvent(signature, payload);
  }

  async handleTransferCreated(transfer: Stripe.Transfer) {
    return this.stripeWebhookService.handleTransferCreated(transfer);
  }

  async issueTicketRefund(ticketId: string, reason?: string) {
    return this.stripeRefundService.issueTicketRefund(ticketId, reason);
  }

  async issueTransactionRefund(transactionId: string) {
    return this.stripeRefundService.issueTransactionRefund(transactionId);
  }
}