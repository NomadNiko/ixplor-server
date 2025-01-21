import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CartClass, CartDocument } from './entities/cart.schema';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { ProductService } from '../products/product.service';

@Injectable()
export class CartService {
constructor(
  @InjectModel(CartClass.name)
  private readonly cartModel: Model<CartDocument>,
  private readonly productService: ProductService,
) {}

private transformCartResponse(cart: any) {
  return {
    _id: cart._id?.toString(),
    userId: cart.userId,
    items: cart.items?.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      productName: item.productName,
      productDate: item.productDate ? new Date(item.productDate).toISOString() : undefined,
      productStartTime: item.productStartTime,
    })) || [],
    total: cart.total || 0,
    createdAt: cart.createdAt ? new Date(cart.createdAt).toISOString() : undefined,
    updatedAt: cart.updatedAt ? new Date(cart.updatedAt).toISOString() : undefined,
  };
}

async getCart(userId: string) {
  const cart = await this.cartModel.findOne({ userId }).lean();
  if (!cart) {
    return {
      userId,
      items: [],
      total: 0,
    };
  }
  return this.transformCartResponse(cart);
}

async addToCart(userId: string, addToCartDto: AddToCartDto) {
  const { productId, quantity, productDate, productStartTime } = addToCartDto;
  
  const product = await this.productService.findById(productId);
  if (!product || !product.data) {
    throw new NotFoundException('Product not found');
  }

  let cart = await this.cartModel.findOne({ userId });
  if (!cart) {
    cart = new this.cartModel({
      userId,
      items: [],
      total: 0
    });
  }

  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId
  );

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    cart.items.push({
      productId,
      quantity,
      price: product.data.productPrice,
      productName: product.data.productName,
      productDate,
      productStartTime,
    });
  }

  const savedCart = await cart.save();
  return this.transformCartResponse(savedCart.toObject());
}

async updateCartItem(userId: string, updateCartItemDto: UpdateCartItemDto) {
  const { productId, quantity } = updateCartItemDto;
  
  const cart = await this.cartModel.findOne({ userId });
  if (!cart) {
    throw new NotFoundException('Cart not found');
  }

  const itemIndex = cart.items.findIndex(item => item.productId === productId);
  if (itemIndex === -1) {
    throw new NotFoundException('Item not found in cart');
  }

  if (quantity === 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity = quantity;
  }

  const updatedCart = await cart.save();
  return this.transformCartResponse(updatedCart.toObject());
}

async removeFromCart(userId: string, productId: string) {
  const cart = await this.cartModel.findOne({ userId });
  if (!cart) {
    throw new NotFoundException('Cart not found');
  }

  const itemIndex = cart.items.findIndex(item => item.productId === productId);
  if (itemIndex === -1) {
    throw new NotFoundException('Item not found in cart');
  }

  cart.items.splice(itemIndex, 1);
  const updatedCart = await cart.save();
  return this.transformCartResponse(updatedCart.toObject());
}

async clearCart(userId: string) {
  const cart = await this.cartModel.findOne({ userId });
  if (!cart) {
    throw new NotFoundException('Cart not found');
  }

  cart.items = [];
  const updatedCart = await cart.save();
  return this.transformCartResponse(updatedCart.toObject());
}

async deleteCart(userId: string) {
  const result = await this.cartModel.deleteOne({ userId });
  if (result.deletedCount === 0) {
    throw new NotFoundException('Cart not found');
  }
  return { message: 'Cart deleted successfully' };
}
}