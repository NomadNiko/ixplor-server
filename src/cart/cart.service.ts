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
      // Return empty cart if none exists
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

    // Verify product exists and get its details
    const product = await this.productService.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Find or create cart
    let cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      cart = new this.cartModel({ userId, items: [], total: 0 });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === productId
    );

    if (existingItemIndex > -1) {
      // Update existing item
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price: product.data.productPrice,
        productName: product.data.productName,
        productDate,
        productStartTime,
      });
    }

    // Recalculate total
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    return cart;
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
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    // Recalculate total
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    return cart;
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
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    return cart;
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.items = [];
    cart.total = 0;
    await cart.save();
    return cart;
  }
}