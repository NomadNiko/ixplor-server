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

export type VendorType = 'tours' | 'lessons' | 'rentals' | 'tickets';

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      // Ensure location object is properly formatted
      ret.location = {
        type: 'Point',
        coordinates: [Number(ret.longitude), Number(ret.latitude)]
      };
      delete ret.__v;
      return ret;
    },
    virtuals: true,
    getters: true,
  }
})
export class VendorSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  businessName: string;

  @Prop({ required: true })
  description: string;

  @Prop({ 
    required: true,
    type: String,
    enum: ['tours', 'lessons', 'rentals', 'tickets']
  })
  vendorType: VendorType;

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
    set: (val: string | number) => Number(val)
  })
  longitude: number;

  @Prop({ 
    required: true, 
    type: Number,
    set: (val: string | number) => Number(val)
  })
  latitude: number;

  @Prop()
  logoUrl?: string;

  @Prop({
    type: String,
    enum: VendorStatusEnum,
    default: VendorStatusEnum.SUBMITTED,
    required: true
  })
  vendorStatus: VendorStatusEnum;

  @Prop()
  actionNeeded?: string;

  @Prop()
  adminNotes?: string;
}

export const VendorSchema = SchemaFactory.createForClass(VendorSchemaClass);

// Add a pre-save middleware to ensure the location object is properly set
VendorSchema.pre('save', function(next) {
  if (this.latitude !== undefined && this.longitude !== undefined) {
    // No need to explicitly set location as it's handled in the transform
    next();
  } else {
    next(new Error('Latitude and longitude are required'));
  }
});

// Create indexes
VendorSchema.index({ latitude: 1, longitude: 1 });
VendorSchema.index({ vendorStatus: 1 });
VendorSchema.index({ vendorType: 1 });
VendorSchema.index({ businessName: 'text', description: 'text' });