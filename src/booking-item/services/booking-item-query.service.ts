import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BookingItemSchemaClass,
  BookingItemSchemaDocument,
  BookingItemStatusEnum,
} from '../infrastructure/persistence/document/entities/booking-item.schema';
import { BookingItemTransformService } from './booking-item-transform.service';

@Injectable()
export class BookingItemQueryService {
  constructor(
    @InjectModel(BookingItemSchemaClass.name)
    private readonly bookingItemModel: Model<BookingItemSchemaDocument>,
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