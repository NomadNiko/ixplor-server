import { Injectable } from '@nestjs/common';

@Injectable()
export class BookingItemTransformService {
  transformBookingItemResponse(item: Record<string, any>) {
    return {
      _id: item._id.toString(),
      productName: item.productName,
      description: item.description,
      imageUrl: item.imageUrl,
      price: item.price,
      duration: item.duration,
      vendorId: item.vendorId,
      status: item.status,
      createdAt: item.createdAt?.toISOString(),
      updatedAt: item.updatedAt?.toISOString(),
    };
  }
}