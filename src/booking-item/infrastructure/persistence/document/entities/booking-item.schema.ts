import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, now } from 'mongoose';
import { EntityDocumentHelper } from '../../../../../utils/document-entity-helper';

export type BookingItemSchemaDocument = HydratedDocument<BookingItemSchemaClass>;

export enum BookingItemStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      if (typeof ret.price === 'number') {
        ret.price = (ret.price / 100).toFixed(2);
      }
      delete ret.__v;
      return ret;
    },
    virtuals: true,
    getters: true,
  }
})
export class BookingItemSchemaClass extends EntityDocumentHelper {
  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  imageUrl?: string;

  @Prop({ 
    required: true,
    type: Number,
    min: 0,
    get: (v: number) => parseFloat((v/100).toFixed(2)),
    set: (v: number) => Math.round(v * 100)
  })
  price: number;

  @Prop({ 
    required: true,
    type: Number,
    min: 30,
    validate: {
      validator: function(v: number) {
        return v % 30 === 0;
      },
      message: 'Duration must be in 30-minute intervals'
    }
  })
  duration: number;

  @Prop({ required: true })
  vendorId: string;

  @Prop({
    type: String,
    enum: BookingItemStatusEnum,
    default: BookingItemStatusEnum.DRAFT,
    required: true
  })
  status: BookingItemStatusEnum;

  @Prop({ default: now })
  createdAt: Date;

  @Prop({ default: now })
  updatedAt: Date;
}

export const BookingItemSchema = SchemaFactory.createForClass(BookingItemSchemaClass);

// Create indexes
BookingItemSchema.index({ vendorId: 1 });
BookingItemSchema.index({ status: 1 });
BookingItemSchema.index({ price: 1 });
BookingItemSchema.index({ duration: 1 });
BookingItemSchema.index({ productName: 'text', description: 'text' });