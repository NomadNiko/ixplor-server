import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CartSchemaClass, CartItemClass, CartItemType } from './entities/cart.schema';
import { AddToCartData, UpdateCartItemData, BookingCartData } from './types/cart.types';
import { ProductItemService } from '../product-item/product-item.service';
import { BookingAssignmentService } from '../booking-assignment/booking-assignment.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { BookingAvailabilityService } from '../booking-availability/booking-availability.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(CartSchemaClass.name)
    private readonly cartModel: Model<CartSchemaClass>,
    private readonly productItemService: ProductItemService,
    private readonly bookingAssignmentService: BookingAssignmentService,
    private readonly bookingItemService: BookingItemService,
    private readonly bookingAvailabilityService: BookingAvailabilityService,
  ) {}

  private transformCartResponse(cart: any) {
    return {
      _id: cart._id.toString(),
      userId: cart.userId,
      items: cart.items.map((item: any) => ({
        _id: item._id.toString(),
        itemType: item.itemType,
        productItemId: item.productItemId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        productDate: item.productDate?.toISOString(),
        productStartTime: item.productStartTime,
        productDuration: item.productDuration,
        vendorId: item.vendorId,
        bookingId: item.bookingId,
        staffId: item.staffId,
        bookingItemId: item.bookingItemId,
        createdAt: item.createdAt?.toISOString(),
        updatedAt: item.updatedAt?.toISOString()
      })),
      isCheckingOut: cart.isCheckingOut,
      createdAt: cart.createdAt?.toISOString(),
      updatedAt: cart.updatedAt?.toISOString()
    };
  }

  async setCheckoutStatus(userId: string, isCheckingOut: boolean) {
    const cart = await this.cartModel.findOne({ userId });
    
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.isCheckingOut = isCheckingOut;
    // If we're resetting checkout status, update the timestamp to prevent immediate cleanup
    if (!isCheckingOut) {
      cart.updatedAt = new Date();
    }
    
    const savedCart = await cart.save();
    return this.transformCartResponse(savedCart);
  }

  async addToCart(addToCartData: AddToCartData) {
    const session = await this.cartModel.db.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const { userId, productItemId, quantity, itemType = CartItemType.PRODUCT } = addToCartData;
  
        // Handle product items
        if (itemType === CartItemType.PRODUCT) {
          const isAvailable = await this.productItemService.validateAvailability(
            productItemId,
            quantity
          );
    
          if (!isAvailable) {
            throw new BadRequestException('Product item is not available in requested quantity');
          }
    
          await this.productItemService.updateQuantityForPurchase(
            productItemId,
            quantity
          );
        }
        
        let cart = await this.cartModel.findOne({ userId }).session(session);
        
        if (!cart) {
          cart = new this.cartModel({
            userId,
            items: [],
          });
        }
  
        const existingItemIndex = cart.items.findIndex(
          item => item.productItemId === productItemId
        );
  
        if (existingItemIndex > -1 && itemType === CartItemType.PRODUCT) {
          cart.items[existingItemIndex].quantity += quantity;
        } else {
          cart.items.push({
            itemType,
            productItemId: addToCartData.productItemId,
            productName: addToCartData.productName,
            price: addToCartData.price,
            quantity: addToCartData.quantity,
            productDate: addToCartData.productDate,
            productStartTime: addToCartData.productStartTime,
            productDuration: addToCartData.productDuration,
            vendorId: addToCartData.vendorId,
            bookingId: addToCartData.bookingId,
            staffId: addToCartData.staffId,
            bookingItemId: addToCartData.bookingItemId
          });
        }
  
        const savedCart = await cart.save({ session });
        return this.transformCartResponse(savedCart);
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async addBookingToCart(bookingData: BookingCartData) {
    const session = await this.cartModel.db.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const { userId, bookingItemId, startDateTime, duration, staffId } = bookingData;
        
        let assignedStaffId = staffId;
        if (!assignedStaffId) {
          // Use the BookingAvailabilityService directly since it has the findAvailableStaff method
          const availableStaff = await this.bookingAvailabilityService.findAvailableStaff(
            bookingItemId,
            startDateTime
          );
          
          if (!availableStaff || availableStaff.length === 0) {
            throw new BadRequestException('No available staff for this booking time');
          }
          
          // Sort by current bookings to find the staff with the least bookings
          availableStaff.sort((a, b) => {
            const aBookings = a.currentBookings;
            const bBookings = b.currentBookings;
            return aBookings - bBookings;
          });
          
          assignedStaffId = availableStaff[0].staffId;
        }
        
        const bookingItem = await this.bookingItemService.findById(bookingItemId);
        if (!bookingItem) {
          throw new NotFoundException('Booking item not found');
        }
        
        const bookingResponse = await this.bookingAssignmentService.addBooking({
          bookingItemId,
          startDateTime,
          duration,
          staffId: assignedStaffId!,
          status: 'PENDING',
          customerId: userId
        });
        
        if (!bookingResponse || !bookingResponse.data) {
          throw new InternalServerErrorException('Failed to create booking');
        }
        
        let cart = await this.cartModel.findOne({ userId }).session(session);
        
        if (!cart) {
          cart = new this.cartModel({
            userId,
            items: [],
          });
        }
        
        cart.items.push({
          itemType: CartItemType.BOOKING,
          productItemId: bookingItemId, // Using bookingItemId as productItemId for compatibility
          bookingItemId,
          productName: bookingData.productName,
          price: bookingData.price,
          quantity: 1, // Bookings are always quantity 1
          productDate: startDateTime,
          productStartTime: bookingData.productStartTime,
          productDuration: duration,
          vendorId: bookingData.vendorId,
          bookingId: bookingResponse.data.bookingId,
          staffId: assignedStaffId
        });
        
        const savedCart = await cart.save({ session });
        return this.transformCartResponse(savedCart);
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateCartItem(
    userId: string,
    productItemId: string,
    updateData: UpdateCartItemData
  ) {
    const cart = await this.cartModel.findOne({ userId });
    
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
      item => item.productItemId === productItemId
    );

    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in cart');
    }
    
    const item = cart.items[itemIndex];
    
    // Booking items can't have their quantity updated
    if (item.itemType === CartItemType.BOOKING) {
      throw new BadRequestException('Booking items cannot have their quantity updated');
    }

    const isAvailable = await this.productItemService.validateAvailability(
      productItemId,
      updateData.quantity
    );

    if (!isAvailable) {
      throw new BadRequestException('Requested quantity is not available');
    }

    cart.items[itemIndex].quantity = updateData.quantity;
    const savedCart = await cart.save();
    return this.transformCartResponse(savedCart);
  }
  
  async removeFromCart(userId: string, productItemId: string) {
    const session = await this.cartModel.db.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const cart = await this.cartModel.findOne({ userId }).session(session);
        
        if (!cart) {
          throw new NotFoundException('Cart not found');
        }

        const itemToRemove = cart.items.find(item => item.productItemId === productItemId);
        if (!itemToRemove) {
          throw new NotFoundException('Item not found in cart');
        }
        
        if (itemToRemove.itemType === CartItemType.PRODUCT) {
          // Return the quantity back to inventory for product items
          await this.productItemService.updateQuantity(
            productItemId,
            itemToRemove.quantity
          );
        } else if (itemToRemove.itemType === CartItemType.BOOKING && itemToRemove.bookingId) {
          // Remove the booking from the staff user
          try {
            if (itemToRemove.staffId && itemToRemove.bookingId) {
              await this.removeBooking(
                itemToRemove.staffId, 
                itemToRemove.bookingId
              );
            }
          } catch (error) {
            console.error('Error removing booking:', error);
            // Continue with cart item removal even if booking removal fails
            console.warn(`Could not remove booking ${itemToRemove.bookingId} from staff ${itemToRemove.staffId}, but will remove from cart`);
          }
        }

        cart.items = cart.items.filter(item => item.productItemId !== productItemId);
        const savedCart = await cart.save({ session });
        return this.transformCartResponse(savedCart);
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  // Helper method to delegate to BookingAssignmentService
  private async removeBooking(staffId: string, bookingId: string): Promise<void> {
    try {
      await this.bookingAssignmentService.removeBooking(staffId, bookingId);
    } catch (error) {
      console.error(`Error in removeBooking helper: ${error.message}`);
      throw error;
    }
  }

  async getCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId });
    return cart ? this.transformCartResponse(cart) : { userId, items: [] };
  }

  async clearCart(userId: string) {
    const session = await this.cartModel.db.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const cart = await this.cartModel.findOne({ userId }).session(session);
        
        if (!cart) {
          return { userId, items: [] };
        }

        // Process each item based on its type
        for (const item of cart.items) {
          if (item.itemType === CartItemType.PRODUCT) {
            // Return product items to inventory
            await this.productItemService.updateQuantity(
              item.productItemId,
              item.quantity
            );
          } else if (item.itemType === CartItemType.BOOKING && item.bookingId) {
            // Remove booking from staff user
            if (item.staffId && item.bookingId) {
              try {
                await this.removeBooking(
                  item.staffId, 
                  item.bookingId
                );
              } catch (error) {
                console.error('Error removing booking:', error);
                // Continue with cart clearing even if booking removal fails
                console.warn(`Could not remove booking ${item.bookingId} from staff ${item.staffId}, but will clear from cart`);
              }
            }
          }
        }

        cart.items = [];
        const savedCart = await cart.save({ session });
        return this.transformCartResponse(savedCart);
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async deleteCart(userId: string) {
    // First clear the cart to handle all the related operations
    await this.clearCart(userId);
    
    // Then delete it
    const cart = await this.cartModel.findOneAndDelete({ userId });
    return cart ? this.transformCartResponse(cart) : { userId, items: [] };
  }
}