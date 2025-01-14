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

interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      if (ret.longitude !== undefined && ret.latitude !== undefined) {
        ret.location = {
          type: 'Point',
          coordinates: [ret.longitude, ret.latitude]
        };
      }
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
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  })
  location: GeoPoint;

  @Prop({
    type: Number,
    required: true,
    set: function(this: VendorSchemaClass, longitude: number) {
      if (this.latitude !== undefined) {
        if (!this.location) {
          this.location = {
            type: 'Point',
            coordinates: [longitude, this.latitude]
          };
        } else {
          this.location.coordinates[0] = longitude;
        }
      }
      return longitude;
    }
  })
  longitude: number;

  @Prop({
    type: Number,
    required: true,
    set: function(this: VendorSchemaClass, latitude: number) {
      if (this.longitude !== undefined) {
        if (!this.location) {
          this.location = {
            type: 'Point',
            coordinates: [this.longitude, latitude]
          };
        } else {
          this.location.coordinates[1] = latitude;
        }
      }
      return latitude;
    }
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

// Add indexes for better query performance
VendorSchema.index({ location: '2dsphere' });
VendorSchema.index({ vendorStatus: 1 });
VendorSchema.index({ vendorType: 1 });
VendorSchema.index({ businessName: 'text', description: 'text' });

// Add instance methods if needed
VendorSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj._id = obj._id.toString();
  if (obj.longitude !== undefined && obj.latitude !== undefined) {
    obj.location = {
      type: 'Point',
      coordinates: [obj.longitude, obj.latitude]
    };
  }
  delete obj.__v;
  return obj;
};

// Add pre-save middleware to ensure location is always set
VendorSchema.pre('save', function(next) {
  if (this.longitude !== undefined && this.latitude !== undefined) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});