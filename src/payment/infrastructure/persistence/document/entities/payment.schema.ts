import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PaymentDocument = HydratedDocument<PaymentSchemaClass>;

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum PaymentRefundStatus {
  NONE = 'NONE',
  PARTIAL = 'PARTIAL',
  FULL = 'FULL'
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
export class PaymentSchemaClass {
  @Prop({ required: true })
  ticketId: string;

  @Prop({ required: true })
  transactionId: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  productItemId: string;

  @Prop({ required: true })
  productDate: Date;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  duration: number;

  @Prop({ 
    type: Number,
    required: true,
    get: (v: number) => (v/100).toFixed(2),
    set: (v: number) => v * 100
  })
  payoutAmount: number;

  @Prop({ 
    type: Number,
    required: true,
    get: (v: number) => (v/100).toFixed(2),
    set: (v: number) => v * 100
  })
  originalAmount: number;

  @Prop({ 
    type: Number,
    required: true,
    get: (v: number) => (v/100).toFixed(2),
    set: (v: number) => v * 100
  })
  applicationFee: number;

  @Prop({ 
    type: Boolean, 
    default: false 
  })
  payoutSent: boolean;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  status: PaymentStatus;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({ 
    type: String,
    enum: PaymentRefundStatus,
    default: PaymentRefundStatus.NONE
  })
  refundStatus: PaymentRefundStatus;

  @Prop({ 
    type: Number,
    default: 0,
    get: (v: number) => (v/100).toFixed(2),
    set: (v: number) => v * 100
  })
  refundAmount: number;

  @Prop()
  refundReason?: string;

  // Add to track last attempted payout date
  @Prop({ type: Date })
  lastPayoutAttemptDate?: Date;

  // Add for more detailed vendor payment tracking
  @Prop({ type: Object })
  payoutDetails?: {
    payoutId?: string;
    processedDate?: Date;
    transferId?: string;
    error?: string;
  };
}

export const PaymentSchema = SchemaFactory.createForClass(PaymentSchemaClass);

// Add indexes for common queries
PaymentSchema.index({ ticketId: 1 });
PaymentSchema.index({ transactionId: 1 });
PaymentSchema.index({ vendorId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ payoutSent: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: 1 });