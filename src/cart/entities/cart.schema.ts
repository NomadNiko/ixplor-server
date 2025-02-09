import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CartDocument = HydratedDocument<CartSchemaClass>;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret._id = ret._id.toString();
      if (ret.items) {
        ret.items = ret.items.map((item: any) => ({
          ...item,
          price: parseFloat(item.price),
          productDate: item.productDate?.toISOString(),
        }));
      }
      delete ret.__v;
      return ret;
    },
    virtuals: true,
  },
})
export class CartItemClass {
  @Prop({ required: true })
  productItemId: string;

  @Prop({ required: true })
  productName: string;

  @Prop({ 
    type: Number,
    required: true,
    get: (v: number) => parseFloat((v/100).toFixed(2)),
    set: (v: number) => Math.round(v * 100)
  })
  price: number;

  @Prop({ 
    type: Number,
    required: true,
    min: 1 
  })
  quantity: number;

  @Prop({ required: true })
  vendorId: string;

  @Prop({ 
    type: Date,
    required: true 
  })
  productDate: Date;

  @Prop({ required: true })
  productStartTime: string;

  @Prop({ 
    type: Number,
    required: true,
    min: 0
  })
  productDuration: number;
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
  },
})
export class CartSchemaClass {
  @Prop({ required: true })
  userId: string;

  @Prop({
    type: [CartItemClass],
    default: [],
  })
  items: CartItemClass[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CartSchema = SchemaFactory.createForClass(CartSchemaClass);

// Add compound index for userId and productItemId to optimize lookups
CartSchema.index({ userId: 1, 'items.productItemId': 1 });

// Add TTL index to automatically remove abandoned carts after 24 hours
CartSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Add index for quick user cart lookups
CartSchema.index({ userId: 1 });

// Virtual for total cart value
CartSchema.virtual('total').get(function() {
  return this.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
});

// Virtual for total number of items
CartSchema.virtual('itemCount').get(function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Pre-save hook to validate all items have the same vendorId
CartSchema.pre('save', function(next) {
  if (this.items.length === 0) {
    return next();
  }

  const vendorId = this.items[0].vendorId;
  const allSameVendor = this.items.every(item => item.vendorId === vendorId);
  
  if (!allSameVendor) {
    const error = new Error('All items in cart must be from the same vendor');
    return next(error);
  }

  next();
});

// Pre-save hook to validate productStartTime format
CartSchema.pre('save', function(next) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  const invalidTimes = this.items.filter(item => 
    !timeRegex.test(item.productStartTime)
  );

  if (invalidTimes.length > 0) {
    const error = new Error('Invalid time format. Must be HH:mm in 24-hour format');
    return next(error);
  }

  next();
});

// Method to calculate total price for a specific item
CartSchema.methods.getItemTotal = function(productItemId: string): number {
  const item = this.items.find(item => item.productItemId === productItemId);
  return item ? item.price * item.quantity : 0;
};

// Method to check if cart contains a specific item
CartSchema.methods.hasItem = function(productItemId: string): boolean {
  return this.items.some(item => item.productItemId === productItemId);
};

// Method to get remaining time before cart expiration
CartSchema.methods.getTimeToExpiration = function(): number {
  const expirationTime = this.createdAt.getTime() + (86400 * 1000); // 24 hours in milliseconds
  return Math.max(0, expirationTime - Date.now());
};