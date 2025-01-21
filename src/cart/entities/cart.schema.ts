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

@Schema({ timestamps: true })
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

// Add indexes
CartSchema.index({ userId: 1 });
CartSchema.index({ 'items.productId': 1 });