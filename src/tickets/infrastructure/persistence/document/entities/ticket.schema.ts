import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TicketDocument = HydratedDocument<TicketSchemaClass>;

export enum TicketStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  REDEEMED = 'REDEEMED',
  REVOKED = 'REVOKED'
}

interface GeoLocation {
  type: string;
  coordinates: number[];
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
export class TicketSchemaClass {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  transactionId: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ required: true })
  productId: string;

  // Product snapshot data
  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  productDescription: string;

  @Prop({ required: true })
  productPrice: number;

  @Prop({ required: true })
  productType: string;

  @Prop()
  productDate?: Date;

  @Prop()
  productStartTime?: string;

  @Prop()
  productDuration?: number;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: undefined
    }
  })
  productLocation?: GeoLocation;

  @Prop()
  productImageURL?: string;

  @Prop()
  productAdditionalInfo?: string;

  @Prop({ type: [String] })
  productRequirements?: string[];

  @Prop()
  productWaiver?: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ default: false })
  used: boolean;

  @Prop()
  usedAt?: Date;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;

  @Prop({
    type: String,
    enum: TicketStatus,
    default: TicketStatus.ACTIVE
  })
  status: TicketStatus;

  @Prop()
  statusUpdateReason?: string;

  @Prop({ type: Date })
  statusUpdatedAt?: Date;

  @Prop()
  statusUpdatedBy?: string;
}

export const TicketSchema = SchemaFactory.createForClass(TicketSchemaClass);

// Add indexes
TicketSchema.index({ userId: 1 });
TicketSchema.index({ transactionId: 1 });
TicketSchema.index({ vendorId: 1 });
TicketSchema.index({ productId: 1 });
TicketSchema.index({ used: 1 });
TicketSchema.index({ productLocation: '2dsphere' }); // Add geospatial index