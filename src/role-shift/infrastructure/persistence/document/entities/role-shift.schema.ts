import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type RoleShiftSchemaDocument = HydratedDocument<RoleShiftSchemaClass>;

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
export class RoleShiftSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  roleId: string;
  
  @Prop({ required: true })
  vendorId: string;
  
  @Prop({ required: true, min: 0, max: 6 })
  dayOfWeek: number;
  
  @Prop({ required: true })
  startTime: string;
  
  @Prop({ required: true })
  endTime: string;
  
  @Prop({ min: 1 })
  capacity: number;
  
  @Prop({ type: [String], default: [] })
  applicableBookingItems: string[];
  
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
  
  @Prop({ default: now })
  createdAt: Date;
  
  @Prop({ default: now })
  updatedAt: Date;
}

export const RoleShiftSchema = SchemaFactory.createForClass(RoleShiftSchemaClass);

RoleShiftSchema.index({ roleId: 1 });
RoleShiftSchema.index({ vendorId: 1 });
RoleShiftSchema.index({ dayOfWeek: 1 });
RoleShiftSchema.index({ isActive: 1 });
RoleShiftSchema.index({ 'applicableBookingItems': 1 });