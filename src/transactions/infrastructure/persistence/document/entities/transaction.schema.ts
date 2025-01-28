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
  DISPUTED = 'disputed'
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  PAYOUT = 'payout'
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
    virtuals: true
  }
})
export class TransactionSchemaClass {
  @Prop({ required: true })
  stripePaymentIntentId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  productId: string;

  @Prop({
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status: TransactionStatus;

  @Prop({
    type: String,
    enum: TransactionType,
    default: TransactionType.PAYMENT
  })
  type: TransactionType;

  @Prop({ type: Object })
  paymentMethodDetails: any;

  @Prop()
  description?: string;

  @Prop()
  receiptEmail?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  refundId?: string;

  @Prop()
  refundAmount?: number;

  @Prop()
  refundReason?: string;

  @Prop()
  disputeId?: string;

  @Prop()
  disputeStatus?: string;

  @Prop()
  disputeAmount?: number;

  @Prop()
  error?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(TransactionSchemaClass);

// Create indexes
TransactionSchema.index({ stripePaymentIntentId: 1 }, { unique: true });
TransactionSchema.index({ vendorId: 1 });
TransactionSchema.index({ customerId: 1 });
TransactionSchema.index({ productId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ createdAt: 1 });