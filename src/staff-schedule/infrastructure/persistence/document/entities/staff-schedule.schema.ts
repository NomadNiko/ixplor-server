
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type StaffScheduleSchemaDocument = HydratedDocument<StaffScheduleSchemaClass>;

export enum StaffScheduleStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
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
export class StaffScheduleSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  vendorId: string;
  
  @Prop({ required: true })
  roleId: string;
  
  @Prop({ required: true })
  staffId: string;
  
  @Prop({ required: true, type: Date })
  date: Date;
  
  @Prop({ required: true })
  startTime: string;
  
  @Prop({ required: true })
  endTime: string;
  
  @Prop({
    type: String,
    enum: StaffScheduleStatusEnum,
    default: StaffScheduleStatusEnum.DRAFT
  })
  status: StaffScheduleStatusEnum;
  
  @Prop()
  notes: string;
  
  @Prop({ default: now })
  createdAt: Date;
  
  @Prop({ default: now })
  updatedAt: Date;
}

export const StaffScheduleSchema = SchemaFactory.createForClass(StaffScheduleSchemaClass);

StaffScheduleSchema.index({ vendorId: 1 });
StaffScheduleSchema.index({ roleId: 1 });
StaffScheduleSchema.index({ staffId: 1 });
StaffScheduleSchema.index({ date: 1 });
StaffScheduleSchema.index({ status: 1 });
StaffScheduleSchema.index({ vendorId: 1, date: 1 });
StaffScheduleSchema.index({ staffId: 1, date: 1 });
StaffScheduleSchema.index({ roleId: 1, date: 1 });