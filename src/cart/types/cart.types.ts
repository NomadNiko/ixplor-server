import { CartItemType } from '../entities/cart.schema';

export interface CartItemData {
  itemType: CartItemType;
  productItemId: string;
  productName: string;
  price: number;
  quantity: number;
  productDate: Date;
  productStartTime: string;
  productDuration: number;
  vendorId: string;
  bookingId?: string;
  staffId?: string;
  bookingItemId?: string;
}

export interface AddToCartData extends CartItemData {
  userId: string;
}

export interface UpdateCartItemData {
  quantity: number;
}

// New types for booking items
export interface BookingCartData {
  userId: string;
  bookingItemId: string;
  staffId?: string;  // Made optional as it might be auto-assigned
  bookingId?: string; // Optional as it might be created during the process
  productName: string;
  price: number;
  quantity: number;
  vendorId: string;
  productDate: Date;
  productStartTime: string;
  productDuration: number;
  startDateTime: Date;
  duration: number;
}