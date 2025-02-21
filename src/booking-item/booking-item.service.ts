import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BookingItemSchemaClass,
  BookingItemSchemaDocument,
  BookingItemStatusEnum,
} from './infrastructure/persistence/document/entities/booking-item.schema';
import { BookingItemQueryService } from './services/booking-item-query.service';
import { BookingItemManagementService } from './services/booking-item-management.service';
import { BookingItemTransformService } from './services/booking-item-transform.service';
import { CreateBookingItemDto } from './dto/create-booking-item.dto';
import { UpdateBookingItemDto } from './dto/update-booking-item.dto';

@Injectable()
export class BookingItemService {
  constructor(
    @InjectModel(BookingItemSchemaClass.name)
    private readonly bookingItemModel: Model<BookingItemSchemaDocument>,
    private readonly queryService: BookingItemQueryService,
    private readonly managementService: BookingItemManagementService,
    private readonly transformService: BookingItemTransformService,
  ) {}

  // Query methods
  findAllItems = this.queryService.findAllItems.bind(this.queryService);
  findPublishedItems = this.queryService.findPublishedItems.bind(this.queryService);
  findByVendor = this.queryService.findByVendor.bind(this.queryService);
  findById = this.queryService.findById.bind(this.queryService);

  // Management methods
  create = this.managementService.create.bind(this.managementService);
  update = this.managementService.update.bind(this.managementService);
  updateStatus = this.managementService.updateStatus.bind(this.managementService);
  remove = this.managementService.remove.bind(this.managementService);
}