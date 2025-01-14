import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type VendorSchemaDocument = HydratedDocument<VendorSchemaClass>;

export enum VendorStatusEnum {
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTION_NEEDED = 'ACTION_NEEDED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    getters: true,
  },
})
export class VendorSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  businessName: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  vendorType: string;

  @Prop()
  website?: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ type: Number })
  longitude?: number;

  @Prop({ type: Number })
  latitude?: number;

  @Prop()
  logoUrl?: string;

  @Prop({
    type: String,
    enum: VendorStatusEnum,
    default: VendorStatusEnum.SUBMITTED
  })
  vendorStatus: VendorStatusEnum;

  @Prop()
  actionNeeded?: string;

  @Prop()
  adminNotes?: string;
}

export const VendorSchema = SchemaFactory.createForClass(VendorSchemaClass);

// Create indexes
VendorSchema.index({ location: '2dsphere' });
VendorSchema.index({ vendorStatus: 1 });
VendorSchema.index({ vendorType: 1 });