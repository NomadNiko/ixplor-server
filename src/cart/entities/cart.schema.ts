import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type CartDocument = HydratedDocument<CartClass>;

@Schema({ timestamps: true })
export class CartItemClass {
  @ApiProperty()
  @Prop({ required: true })
  productId: string;

  @ApiProperty()
  @Prop({ required: true })
  quantity: number;

  @ApiProperty()
  @Prop({ required: true })
  price: number;

  @ApiProperty()
  @Prop({ required: true })
  productName: string;

  @ApiProperty()
  @Prop()
  productDate?: Date;

  @ApiProperty()
  @Prop()
  productStartTime?: string;
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      // Transform the main document _id
      ret._id = ret._id?.toString();
      
      // Transform items array if it exists
      if (ret.items) {
        ret.items = ret.items.map(item => ({
          ...item,
          _id: item._id?.toString(),
          productDate: item.productDate ? new Date(item.productDate).toISOString() : undefined
        }));
      }

      // Calculate total
      ret.total = ret.items?.reduce(
        (sum, item) => sum + (item.price * item.quantity),
        0
      ) || 0;

      // Remove mongoose internals
      delete ret.__v;
      
      return ret;
    },
    virtuals: true,
    getters: true,
  }
})
export class CartClass {
  @ApiProperty()
  @Prop({ required: true })
  userId: string;

  @ApiProperty({ type: [CartItemClass] })
  @Prop({ type: [CartItemClass], default: [] })
  items: CartItemClass[];

  @ApiProperty()
  @Prop({ required: true, default: 0 })
  total: number;
}

export const CartSchema = SchemaFactory.createForClass(CartClass);

// Add indexes for better query performance
CartSchema.index({ userId: 1 });
CartSchema.index({ 'items.productId': 1 });

// Pre-save hook to calculate total
CartSchema.pre('save', function(next) {
  if (this.items) {
    this.total = this.items.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );
  }
  next();
});