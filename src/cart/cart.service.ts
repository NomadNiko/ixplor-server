import { Injectable, NotFoundException } from '@nestjs/common';
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

  async getCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId }).lean();
    if (!cart) {
      return {
        userId,
        items: [],
        total: 0,
      };
    }
    return cart;
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

    // Let the pre-save middleware handle total calculation
    return await cart.save();
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

    return await cart.save();
  }

  async removeFromCart(userId: string, productId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.items = cart.items.filter(item => item.productId !== productId);
    return await cart.save();
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.items = [];
    return await cart.save();
  }
}