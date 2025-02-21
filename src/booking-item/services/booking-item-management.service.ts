import {
    Injectable,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectModel } from '@nestjs/mongoose';
  import { Model } from 'mongoose';
  import {
    BookingItemSchemaClass,
    BookingItemSchemaDocument,
    BookingItemStatusEnum,
  } from '../infrastructure/persistence/document/entities/booking-item.schema';
  import { BookingItemTransformService } from './booking-item-transform.service';
  import { CreateBookingItemDto } from '../dto/create-booking-item.dto';
  import { UpdateBookingItemDto } from '../dto/update-booking-item.dto';
  
  @Injectable()
  export class BookingItemManagementService {
    constructor(
      @InjectModel(BookingItemSchemaClass.name)
      private readonly bookingItemModel: Model<BookingItemSchemaDocument>,
      private readonly transformService: BookingItemTransformService,
    ) {}
  
    async create(createBookingItemDto: CreateBookingItemDto) {
      try {
        // Validate duration is in 30-minute intervals
        if (createBookingItemDto.duration % 30 !== 0 || createBookingItemDto.duration <= 0) {
          throw new BadRequestException('Duration must be a positive multiple of 30 minutes');
        }
  
        const bookingItem = new this.bookingItemModel({
          ...createBookingItemDto,
          status: BookingItemStatusEnum.DRAFT,
        });
        
        const savedItem = await bookingItem.save();
        
        return {
          data: this.transformService.transformBookingItemResponse(savedItem),
          message: 'Booking item created successfully',
        };
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        if (error.name === 'ValidationError') {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    }
  
    async update(id: string, updateBookingItemDto: UpdateBookingItemDto) {
      try {
        // Validate duration if provided
        if (updateBookingItemDto.duration && 
            (updateBookingItemDto.duration % 30 !== 0 || updateBookingItemDto.duration <= 0)) {
          throw new BadRequestException('Duration must be a positive multiple of 30 minutes');
        }
  
        const updatedItem = await this.bookingItemModel
          .findByIdAndUpdate(
            id,
            { $set: updateBookingItemDto },
            { new: true, runValidators: true }
          )
          .exec();
        
        if (!updatedItem) {
          throw new NotFoundException(`Booking item with ID ${id} not found`);
        }
        
        return {
          data: this.transformService.transformBookingItemResponse(updatedItem),
          message: 'Booking item updated successfully',
        };
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof BadRequestException) {
          throw error;
        }
        if (error.name === 'ValidationError') {
          throw new BadRequestException(error.message);
        }
        throw error;
      }
    }
  
    async updateStatus(id: string, status: BookingItemStatusEnum) {
      const item = await this.bookingItemModel.findById(id).exec();
      
      if (!item) {
        throw new NotFoundException(`Booking item with ID ${id} not found`);
      }
      
      item.status = status;
      item.updatedAt = new Date();
      
      const updatedItem = await item.save();
      
      return {
        data: this.transformService.transformBookingItemResponse(updatedItem),
        message: 'Booking item status updated successfully',
      };
    }
  
    async remove(id: string) {
      const item = await this.bookingItemModel.findById(id);
      
      if (!item) {
        throw new NotFoundException(`Booking item with ID ${id} not found`);
      }
      
      await this.bookingItemModel.findByIdAndDelete(id);
      
      return {
        message: 'Booking item deleted successfully',
      };
    }
  }