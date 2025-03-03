import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BookingItemSchemaClass,
  BookingItemSchemaDocument,
  BookingItemStatusEnum,
} from '../infrastructure/persistence/document/entities/booking-item.schema';
import { BookingItemTransformService } from './booking-item-transform.service';
import { VendorSearchService } from 'src/vendors/services/vendor-search.service';

@Injectable()
export class BookingItemQueryService {
  constructor(
    @InjectModel(BookingItemSchemaClass.name)
    private readonly bookingItemModel: Model<BookingItemSchemaDocument>,
    private readonly vendorSearchService: VendorSearchService,
    private readonly transformService: BookingItemTransformService,
  ) {}

  async findAllItems() {
    const items = await this.bookingItemModel.find().select('-__v').lean().exec();
    return {
      data: items.map((item) => this.transformService.transformBookingItemResponse(item)),
    };
  }

  async findPublishedItems() {
    const items = await this.bookingItemModel
      .find({
        status: BookingItemStatusEnum.PUBLISHED,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map((item) => this.transformService.transformBookingItemResponse(item)),
    };
  }

  async findNearby(lat: number, lng: number, radius: number = 10) {
    try {
      const vendorResponse = await this.vendorSearchService.findNearby(lat, lng, radius);
      
      if (!vendorResponse || !vendorResponse.data || !Array.isArray(vendorResponse.data)) {
        console.warn('No vendors found nearby or invalid response structure');
        return { data: [] };
      }
      
      const nearbyVendors = vendorResponse.data;
      const vendorIds = nearbyVendors.map(v => typeof v._id === 'string' ? v._id : String(v._id));
      
      if (vendorIds.length === 0) {
        console.log('No vendor IDs found in the nearby area');
        return { data: [] };
      }
      
      const items = await this.bookingItemModel
        .find({
          vendorId: { $in: vendorIds },
          status: BookingItemStatusEnum.PUBLISHED,
        })
        .select('-__v')
        .lean()
        .exec();
      
      // Create a vendor map for easy lookup
      const vendorMap = {};
      nearbyVendors.forEach(vendor => {
        vendorMap[vendor._id.toString()] = vendor;
      });
      
      // Explicitly annotate each item with vendor location
      const enrichedItems = items.map(item => {
        const vendor = vendorMap[item.vendorId];
        if (vendor && vendor.location && vendor.location.coordinates) {
          // Deep clone to avoid reference issues
          const enrichedItem = JSON.parse(JSON.stringify(item));
          // Explicitly set the coordinates
          enrichedItem.longitude = vendor.location.coordinates[0];
          enrichedItem.latitude = vendor.location.coordinates[1];
          // Also set in location object format
          enrichedItem.location = {
            type: 'Point',
            coordinates: [vendor.location.coordinates[0], vendor.location.coordinates[1]]
          };
          enrichedItem.vendorBusinessName = vendor.businessName;
          return enrichedItem;
        }
        return item;
      });
      
      return {
        data: enrichedItems.map(item => this.transformService.transformBookingItemResponse(item)),
      };
    } catch (error) {
      console.error('Error in findNearby:', error);
      throw error;
    }
  }

  async findNearbyToday(
    lat: number, 
    lng: number, 
    radius: number = 10,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      const vendorResponse = await this.vendorSearchService.findNearby(lat, lng, radius);
      
      if (!vendorResponse || !vendorResponse.data || !Array.isArray(vendorResponse.data)) {
        console.warn('No vendors found nearby or invalid response structure');
        return { data: [] };
      }
      
      const nearbyVendors = vendorResponse.data;
      
      const vendorIds = nearbyVendors.map(v => typeof v._id === 'string' ? v._id : String(v._id));
      
      if (vendorIds.length === 0) {
        console.log('No vendor IDs found in the nearby area');
        return { data: [] };
      }
  
      const today = startDate || new Date();
      today.setHours(0, 0, 0, 0);
      
      const endOfRange = endDate || new Date(today);
      endOfRange.setDate(today.getDate() + 2);
      
      console.log(`Finding booking items between ${today.toISOString()} and ${endOfRange.toISOString()}`);
      console.log(`For vendors: ${vendorIds.join(', ')}`);
  
      const items = await this.bookingItemModel
        .find({
          vendorId: { $in: vendorIds },
          status: BookingItemStatusEnum.PUBLISHED,
        })
        .select('-__v')
        .lean()
        .exec();
      
      console.log(`Found ${items.length} booking items`);
  
      // Enrich booking items with vendor location data
      const enrichedItems = items.map(item => {
        const vendor = nearbyVendors.find(v => v._id.toString() === item.vendorId);
        
        if (vendor && vendor.location && vendor.location.coordinates) {
          return {
            ...this.transformService.transformBookingItemResponse(item),
            // Add vendor coordinates to the item
            longitude: vendor.location.coordinates[0],
            latitude: vendor.location.coordinates[1],
            // Optional: add vendor name for additional context
            vendorBusinessName: vendor.businessName || 'Unknown Vendor'
          };
        }
        
        return this.transformService.transformBookingItemResponse(item);
      });
  
      return {
        data: enrichedItems
      };
    } catch (error) {
      console.error('Error in findNearbyToday:', error);
      throw error;
    }
  }

  async findByVendor(vendorId: string) {
    const items = await this.bookingItemModel
      .find({
        vendorId: vendorId,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map((item) => this.transformService.transformBookingItemResponse(item)),
    };
  }

  async findPublicByVendor(vendorId: string) {
    const items = await this.bookingItemModel
      .find({
        vendorId: vendorId,
        status: BookingItemStatusEnum.PUBLISHED,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map((item) => this.transformService.transformBookingItemResponse(item)),
    };
  }

  async findById(id: string) {
    const item = await this.bookingItemModel
      .findById(id)
      .select('-__v')
      .lean()
      .exec();
    if (!item) {
      throw new NotFoundException(`Booking item with ID ${id} not found`);
    }
    return {
      data: this.transformService.transformBookingItemResponse(item),
    };
  }
}