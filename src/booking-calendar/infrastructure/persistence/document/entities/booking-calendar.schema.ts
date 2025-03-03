import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type BookingCalendarSchemaDocument = HydratedDocument<BookingCalendarSchemaClass>;

export enum BookingStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      delete ret.__v;
      return ret;
    },
    virtuals: true,
    getters: true,
  }
})
export class BookingCalendarSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  bookingId: string;
  
  @Prop({ required: true })
  bookingItemId: string;
  
  @Prop({ required: true })
  roleId: string;
  
  @Prop()
  staffId: string;
  
  @Prop({ required: true })
  vendorId: string;
  
  @Prop({ required: true })
  customerId: string;
  
  @Prop({ required: true, type: Date })
  startDateTime: Date;
  
  @Prop({ required: true })
  duration: number;
  
  @Prop({
    type: String,
    enum: BookingStatusEnum,
    default: BookingStatusEnum.PENDING
  })
  status: BookingStatusEnum;
  
  @Prop()
  transactionId: string;
  
  @Prop()
  notes: string;
  
  @Prop()
  statusUpdateReason: string;
  
  @Prop()
  statusUpdatedBy: string;
  
  @Prop()
  statusUpdatedAt: Date;
  
  @Prop({ default: now })
  createdAt: Date;
  
  @Prop({ default: now })
  updatedAt: Date;
}

export const BookingCalendarSchema = SchemaFactory.createForClass(BookingCalendarSchemaClass);

BookingCalendarSchema.index({ bookingId: 1 });
BookingCalendarSchema.index({ bookingItemId: 1 });
BookingCalendarSchema.index({ roleId: 1 });
BookingCalendarSchema.index({ staffId: 1 });
BookingCalendarSchema.index({ vendorId: 1 });
BookingCalendarSchema.index({ customerId: 1 });
BookingCalendarSchema.index({ startDateTime: 1 });
BookingCalendarSchema.index({ status: 1 });
BookingCalendarSchema.index({ vendorId: 1, startDateTime: 1 });
BookingCalendarSchema.index({ roleId: 1, startDateTime: 1 });
BookingCalendarSchema.index({ staffId: 1, startDateTime: 1 });