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
      date: item.date?.toISOString ? item.date.toISOString() : item.date,
      location: {
        type: 'Point',
        coordinates: [
          item.vendorLongitude !== undefined ? item.vendorLongitude : 
          (item.longitude !== undefined ? item.longitude : null),
          item.vendorLatitude !== undefined ? item.vendorLatitude : 
          (item.latitude !== undefined ? item.latitude : null)
        ]
      },
      latitude: item.vendorLatitude !== undefined ? item.vendorLatitude : 
        (item.latitude !== undefined ? item.latitude : null),
      longitude: item.vendorLongitude !== undefined ? item.vendorLongitude : 
        (item.longitude !== undefined ? item.longitude : null),
      vendorBusinessName: item.vendorBusinessName,
      createdAt: item.createdAt?.toISOString ? item.createdAt.toISOString() : item.createdAt,
      updatedAt: item.updatedAt?.toISOString ? item.updatedAt.toISOString() : item.updatedAt,
    };
  }
}