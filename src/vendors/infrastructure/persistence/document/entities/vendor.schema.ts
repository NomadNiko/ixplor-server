import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';

export type VendorSchemaDocument = HydratedDocument<VendorSchemaClass>;

export enum VendorStatusEnum {
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTION_NEEDED = 'ACTION_NEEDED', 
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export type VendorType = 'tours' | 'lessons' | 'rentals' | 'tickets';

@Schema({
  timestamps: true,
})
export class VendorSchemaClass {
  @Prop({ required: true })
  businessName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ 
    type: [String],
    enum: ['tours', 'lessons', 'rentals', 'tickets'],
    default: []
  })
  vendorTypes: VendorType[];

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

  @Prop({ 
    required: true, 
    type: Number,
  })
  longitude: number;

  @Prop({ 
    required: true, 
    type: Number,
  })
  latitude: number;

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

  @Prop({ 
    type: [String],
    default: [] 
  })
  ownerIds: string[];

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const VendorSchema = SchemaFactory.createForClass(VendorSchemaClass);

// Add indexes
VendorSchema.index({ latitude: 1, longitude: 1 });
VendorSchema.index({ vendorStatus: 1 });
VendorSchema.index({ vendorTypes: 1 });
VendorSchema.index({ businessName: 'text', description: 'text' });