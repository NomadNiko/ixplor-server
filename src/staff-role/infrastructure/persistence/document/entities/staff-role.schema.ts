import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type StaffRoleSchemaDocument = HydratedDocument<StaffRoleSchemaClass>;

@Schema({
  timestamps: true,
  toJSON:  {
    transform: function(doc, ret) {
      ret._id = ret._id.toString();
      delete ret.$__;
      delete ret.$isNew;
      return ret;
    },
    virtuals: true,
    getters: true,
  }
})
export class StaffRoleSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  name: string;
  
  @Prop({ required: true })
  vendorId: string;
  
  @Prop({ type: [String], default: [] })
  qualifiedBookingItems: string[];
  
  @Prop({ required: true, min: 1, default: 1 })
  defaultCapacity: number;
  
  @Prop()
  description: string;
  
  @Prop()
  requirements: string;
  
  @Prop({ type: Boolean, default: true })
  isActive: boolean;
  
  @Prop({ default: now })
  createdAt: Date;
  
  @Prop({ default: now })
  updatedAt: Date;
}

export const StaffRoleSchema = SchemaFactory.createForClass(StaffRoleSchemaClass);

StaffRoleSchema.index({ vendorId: 1 });
StaffRoleSchema.index({ name: 'text' });
StaffRoleSchema.index({ qualifiedBookingItems: 1 });
StaffRoleSchema.index({ isActive: 1 });