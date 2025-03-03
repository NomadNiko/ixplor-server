import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type ScheduleExceptionSchemaDocument = HydratedDocument<ScheduleExceptionSchemaClass>;

export enum ExceptionTypeEnum {
  CLOSED = 'CLOSED',
  MODIFIED_HOURS = 'MODIFIED_HOURS',
  SPECIAL_EVENT = 'SPECIAL_EVENT',
  BLACKOUT = 'BLACKOUT',
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
export class ScheduleExceptionSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  vendorId: string;
  
  @Prop({ required: true, type: Date })
  date: Date;
  
  @Prop({ 
    type: String,
    enum: ExceptionTypeEnum,
    required: true
  })
  exceptionType: ExceptionTypeEnum;
  
  @Prop()
  description: string;
  
  @Prop({ type: [String], default: [] })
  affectedRoleIds: string[];
  
  @Prop({ type: [String], default: [] })
  affectedBookingItemIds: string[];
  
  @Prop()
  modifiedStartTime: string;
  
  @Prop()
  modifiedEndTime: string;
  
  @Prop()
  modifiedCapacity: number;
  
  @Prop({ default: now })
  createdAt: Date;
  
  @Prop({ default: now })
  updatedAt: Date;
}

export const ScheduleExceptionSchema = SchemaFactory.createForClass(ScheduleExceptionSchemaClass);

ScheduleExceptionSchema.index({ vendorId: 1 });
ScheduleExceptionSchema.index({ date: 1 });
ScheduleExceptionSchema.index({ exceptionType: 1 });
ScheduleExceptionSchema.index({ 'affectedRoleIds': 1 });
ScheduleExceptionSchema.index({ 'affectedBookingItemIds': 1 });
ScheduleExceptionSchema.index({ vendorId: 1, date: 1 });