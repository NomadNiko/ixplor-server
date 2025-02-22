import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now, Types } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type StaffUserSchemaDocument = HydratedDocument<StaffUserSchemaClass>;

export enum StaffUserStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

@Schema({
  _id: false,
  timestamps: false
})
export class ShiftObject {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true, type: Date })
  startDateTime: Date;

  @Prop({ required: true, type: Date })
  endDateTime: Date;
}

@Schema({
  _id: false,
  timestamps: false
})
export class BookedObject {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id?: Types.ObjectId;

  @Prop({ required: true })
  bookingItemId: string;

  @Prop({ required: true, type: Date })
  startDateTime: Date;

  @Prop({ required: true, type: Number, min: 0 })
  duration: number;

  @Prop({ type: String })
  transactionId?: string;

  @Prop({ type: String })
  customerId?: string;

  @Prop({ 
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  })
  status: string;
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
export class StaffUserSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ type: [String], default: [] })
  qualifiedProducts: string[];

  @Prop({ type: [ShiftObject], default: [] })
  shifts: ShiftObject[];

  @Prop({ type: [BookedObject], default: [] })
  bookedObjects: BookedObject[];

  @Prop({
    type: String,
    enum: StaffUserStatusEnum,
    default: StaffUserStatusEnum.ACTIVE
  })
  status: StaffUserStatusEnum;

  @Prop({ type: String, required: false })
  email?: string;

  @Prop({ type: String, required: false })
  phone?: string;

  @Prop({ type: String, required: false })
  notes?: string;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const StaffUserSchema = SchemaFactory.createForClass(StaffUserSchemaClass);

// Create indexes
StaffUserSchema.index({ vendorId: 1 });
StaffUserSchema.index({ status: 1 });
StaffUserSchema.index({ qualifiedProducts: 1 });
StaffUserSchema.index({ 'shifts.startDateTime': 1, 'shifts.endDateTime': 1 });
StaffUserSchema.index({ 'bookedObjects.startDateTime': 1 });
StaffUserSchema.index({ 'bookedObjects.bookingItemId': 1 });
StaffUserSchema.index({ 'bookedObjects.status': 1 });

// Virtual properties
StaffUserSchema.virtual('currentWorkload').get(function() {
  const now = new Date();
  const activeBookings = this.bookedObjects.filter(booking => 
    booking.status !== 'CANCELLED' && 
    new Date(booking.startDateTime) <= now && 
    new Date(booking.startDateTime.getTime() + booking.duration * 60000) > now
  );
  return activeBookings.length;
});

StaffUserSchema.virtual('dailyWorkload').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todaysBookings = this.bookedObjects.filter(booking => 
    booking.status !== 'CANCELLED' && 
    new Date(booking.startDateTime) >= today && 
    new Date(booking.startDateTime) < tomorrow
  );
  return todaysBookings.length;
});

StaffUserSchema.virtual('availableTimeSlots').get(function() {
  return [];
});

StaffUserSchema.virtual('qualificationCount').get(function() {
  return this.qualifiedProducts.length;
});