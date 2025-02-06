import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TransactionDocument = HydratedDocument<TransactionSchemaClass>;

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  DISPUTED = 'disputed',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  PAYOUT = 'payout',
}

export interface StripePaymentMethodDetails {
  type?: string;
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
    country?: string;
  };
  billing_details?: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
}

export interface StripeTransferDetails {
  destination?: string; // Stripe account ID where funds were transferred
  destination_payment?: string; // Stripe payment ID on the destination account
  source_type?: string;
  transfer_group?: string;
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      // Convert amount from cents to dollars for JSON responses
      if (typeof ret.amount === 'number') {
        ret.amount = (ret.amount / 100).toFixed(2);
      }
      if (typeof ret.refundAmount === 'number') {
        ret.refundAmount = (ret.refundAmount / 100).toFixed(2);
      }
      if (typeof ret.disputeAmount === 'number') {
        ret.disputeAmount = (ret.disputeAmount / 100).toFixed(2);
      }
      delete ret.__v;
      return ret;
    },
    virtuals: true,
  },
})
export class TransactionSchemaClass {
  @Prop({
    required: function (this: TransactionSchemaClass) {
      return this.type === TransactionType.PAYMENT;
    },
  })
  stripeCheckoutSessionId?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({
    required: function (this: TransactionSchemaClass) {
      return this.type === TransactionType.PAYMENT;
    },
  })
  customerId?: string;

  @Prop({
    required: function (this: TransactionSchemaClass) {
      return this.type === TransactionType.PAYMENT;
    },
  })
  productId?: string;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Prop({
    type: String,
    enum: TransactionType,
    required: true,
  })
  type: TransactionType;

  @Prop({ type: Object }) // Changed from required to optional
  paymentMethodDetails?: StripePaymentMethodDetails;

  @Prop({
    type: Object,
    required: function (this: TransactionSchemaClass) {
      return this.type === TransactionType.PAYOUT;
    },
  })
  transferDetails?: StripeTransferDetails;

  @Prop()
  description?: string;

  @Prop()
  receiptEmail?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  // Fields for refunds
  @Prop({
    required: function (this: TransactionSchemaClass) {
      return this.type === TransactionType.REFUND;
    },
  })
  refundId?: string;

  @Prop()
  refundAmount?: number;

  @Prop()
  refundReason?: string;

  // Fields for disputes
  @Prop()
  disputeId?: string;

  @Prop()
  disputeStatus?: string;

  @Prop()
  disputeAmount?: number;

  // Fields for payout specific details
  @Prop()
  payoutMethod?: string;

  @Prop()
  payoutDestination?: string;

  @Prop()
  payoutArrivalDate?: Date;

  // Error tracking
  @Prop()
  error?: string;

  @Prop({ type: Object })
  errorDetails?: Record<string, any>;

  // Timestamps
  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;

  // For keeping track of related transactions
  @Prop()
  originalTransactionId?: string;

  // Automatic balance tracking
  @Prop()
  previousBalance?: number;

  @Prop()
  newBalance?: number;

  // Audit fields
  @Prop()
  initiatedBy?: string;

  @Prop()
  lastModifiedBy?: string;
}

export const TransactionSchema = SchemaFactory.createForClass(
  TransactionSchemaClass,
);

// Create indexes
TransactionSchema.index(
  { stripeCheckoutSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: TransactionType.PAYMENT },
  },
);
TransactionSchema.index({ vendorId: 1 });
TransactionSchema.index({ customerId: 1 });
TransactionSchema.index({ productId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ createdAt: 1 });
TransactionSchema.index({ payoutDestination: 1 });
TransactionSchema.index({ originalTransactionId: 1 });

// Add compound indexes for common queries
TransactionSchema.index({ vendorId: 1, type: 1, status: 1 });
TransactionSchema.index({ vendorId: 1, createdAt: -1 });

// Add text index for searching
TransactionSchema.index({ description: 'text' });

// Pre-save middleware for setting default values and validations
TransactionSchema.pre('save', function (next) {
  // Ensure amounts are always stored as integers (cents)
  if (this.amount && !Number.isInteger(this.amount)) {
    this.amount = Math.round(this.amount * 100);
  }
  if (this.refundAmount && !Number.isInteger(this.refundAmount)) {
    this.refundAmount = Math.round(this.refundAmount * 100);
  }
  if (this.disputeAmount && !Number.isInteger(this.disputeAmount)) {
    this.disputeAmount = Math.round(this.disputeAmount * 100);
  }

  // Set default metadata if none provided
  if (!this.metadata) {
    this.metadata = {};
  }

  // Additional validation based on transaction type
  if (this.type === TransactionType.PAYOUT && !this.payoutDestination) {
    next(new Error('Payout destination is required for payout transactions'));
    return;
  }

  next();
});

// Virtual for formatted amount
TransactionSchema.virtual('formattedAmount').get(function () {
  return (this.amount / 100).toFixed(2);
});
