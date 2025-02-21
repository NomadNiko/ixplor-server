import { BookingItemStatusEnum } from '../infrastructure/persistence/document/entities/booking-item.schema';

export interface BookingItemBase {
  productName: string;
  description: string;
  imageUrl?: string;
  price: number;
  duration: number;
  vendorId: string;
  status: BookingItemStatusEnum;
}

export interface BookingItemResponse extends Omit<BookingItemBase, 'price'> {
  _id: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingItemDto extends Omit<BookingItemBase, 'status'> {
  productName: string;
  description: string;
  imageUrl?: string;
  price: number;
  duration: number;
  vendorId: string;
}

export interface UpdateBookingItemDto extends Partial<CreateBookingItemDto> {
  status?: BookingItemStatusEnum;
}

export interface BookingItemServiceResponse<T> {
  data: T;
  message?: string;
}

export interface BookingItemQueryResponse<T> {
  data: T[];
}