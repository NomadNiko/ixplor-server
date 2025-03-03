import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  ScheduleExceptionSchemaClass, 
  ScheduleExceptionSchemaDocument,
  ExceptionTypeEnum
} from './infrastructure/persistence/document/entities/schedule-exception.schema';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto';
import { StaffRoleService } from '../staff-role/staff-role.service';
import { BookingItemService } from '../booking-item/booking-item.service';

@Injectable()
export class ScheduleExceptionService {
  constructor(
    @InjectModel(ScheduleExceptionSchemaClass.name)
    private readonly exceptionModel: Model<ScheduleExceptionSchemaDocument>,
    private readonly staffRoleService: StaffRoleService,
    private readonly bookingItemService: BookingItemService
  ) {}

  async create(createExceptionDto: CreateScheduleExceptionDto) {
    try {
      // Validate that both affected roles and booking items belong to the vendor
      if (createExceptionDto.affectedRoleIds?.length) {
        for (const roleId of createExceptionDto.affectedRoleIds) {
          const role = await this.staffRoleService.findById(roleId);
          if (role.data.vendorId !== createExceptionDto.vendorId) {
            throw new BadRequestException(`Role with ID ${roleId} does not belong to this vendor`);
          }
        }
      }

      if (createExceptionDto.affectedBookingItemIds?.length) {
        for (const bookingItemId of createExceptionDto.affectedBookingItemIds) {
          const bookingItem = await this.bookingItemService.findById(bookingItemId);
          if (bookingItem.data.vendorId !== createExceptionDto.vendorId) {
            throw new BadRequestException(`Booking item with ID ${bookingItemId} does not belong to this vendor`);
          }
        }
      }

      // If it's a modified hours exception, ensure the time fields are present
      if (createExceptionDto.exceptionType === ExceptionTypeEnum.MODIFIED_HOURS) {
        if (!createExceptionDto.modifiedStartTime || !createExceptionDto.modifiedEndTime) {
          throw new BadRequestException('Modified hours exception requires start and end times');
        }
        
        // Validate time format
        this.validateTimeFormat(createExceptionDto.modifiedStartTime);
        this.validateTimeFormat(createExceptionDto.modifiedEndTime);
        
        if (createExceptionDto.modifiedStartTime >= createExceptionDto.modifiedEndTime) {
          throw new BadRequestException('Modified end time must be after start time');
        }
      }

      const exception = new this.exceptionModel(createExceptionDto);
      const savedException = await exception.save();
      
      return {
        data: savedException,
        message: 'Schedule exception created successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating schedule exception:', error);
      throw new InternalServerErrorException('Failed to create schedule exception');
    }
  }

  async findAll() {
    try {
      const exceptions = await this.exceptionModel.find().exec();
      return { data: exceptions };
    } catch (error) {
      console.error('Error fetching all schedule exceptions:', error);
      throw new InternalServerErrorException('Failed to fetch schedule exceptions');
    }
  }

  async findById(id: string) {
    try {
      const exception = await this.exceptionModel.findById(id).exec();
      
      if (!exception) {
        throw new NotFoundException(`Schedule exception with ID ${id} not found`);
      }
      
      return {
        data: exception
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error fetching schedule exception with ID ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch schedule exception');
    }
  }

  async findByVendor(vendorId: string) {
    try {
      const exceptions = await this.exceptionModel.find({ vendorId }).exec();
      return { 
        data: exceptions,
        message: `Found ${exceptions.length} schedule exceptions for vendor ${vendorId}`
      };
    } catch (error) {
      console.error(`Error fetching schedule exceptions for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to fetch vendor schedule exceptions');
    }
  }

  async findForDate(vendorId: string | null, date: Date) {
    try {
      // Convert date to start of day
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      
      // Create query - if vendorId is null, find all exceptions for this date
      const query: any = { date: queryDate };
      if (vendorId) {
        query.vendorId = vendorId;
      }
      
      const exceptions = await this.exceptionModel.find(query).exec();
      
      return { 
        data: exceptions,
        message: `Found ${exceptions.length} schedule exceptions for date ${queryDate.toISOString().split('T')[0]}`
      };
    } catch (error) {
      console.error(`Error fetching schedule exceptions for date ${date}:`, error);
      throw new InternalServerErrorException('Failed to fetch schedule exceptions for date');
    }
  }

  async findByDateRange(vendorId: string, startDate: Date, endDate: Date) {
    try {
      // Adjust dates to start and end of day
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const exceptions = await this.exceptionModel.find({
        vendorId,
        date: {
          $gte: start,
          $lte: end
        }
      }).sort({ date: 1 }).exec();
      
      return { 
        data: exceptions,
        message: `Found ${exceptions.length} schedule exceptions in date range`
      };
    } catch (error) {
      console.error(`Error fetching schedule exceptions for date range:`, error);
      throw new InternalServerErrorException('Failed to fetch schedule exceptions for date range');
    }
  }

  async update(id: string, updateExceptionDto: UpdateScheduleExceptionDto) {
    try {
      const exception = await this.exceptionModel.findById(id);
      
      if (!exception) {
        throw new NotFoundException(`Schedule exception with ID ${id} not found`);
      }
      
      // Vendor ID is immutable
      if (updateExceptionDto.vendorId && updateExceptionDto.vendorId !== exception.vendorId) {
        throw new BadRequestException('Vendor ID cannot be changed');
      }
      
      // Validate roles and booking items if they're being updated
      if (updateExceptionDto.affectedRoleIds?.length) {
        for (const roleId of updateExceptionDto.affectedRoleIds) {
          const role = await this.staffRoleService.findById(roleId);
          if (role.data.vendorId !== exception.vendorId) {
            throw new BadRequestException(`Role with ID ${roleId} does not belong to this vendor`);
          }
        }
      }

      if (updateExceptionDto.affectedBookingItemIds?.length) {
        for (const bookingItemId of updateExceptionDto.affectedBookingItemIds) {
          const bookingItem = await this.bookingItemService.findById(bookingItemId);
          if (bookingItem.data.vendorId !== exception.vendorId) {
            throw new BadRequestException(`Booking item with ID ${bookingItemId} does not belong to this vendor`);
          }
        }
      }

      // If changing to modified hours or updating time fields for modified hours
      if (
        (updateExceptionDto.exceptionType === ExceptionTypeEnum.MODIFIED_HOURS) ||
        (exception.exceptionType === ExceptionTypeEnum.MODIFIED_HOURS && 
         (updateExceptionDto.modifiedStartTime || updateExceptionDto.modifiedEndTime))
      ) {
        const startTime = updateExceptionDto.modifiedStartTime || exception.modifiedStartTime;
        const endTime = updateExceptionDto.modifiedEndTime || exception.modifiedEndTime;
        
        if (!startTime || !endTime) {
          throw new BadRequestException('Modified hours exception requires start and end times');
        }
        
        // Validate time format
        this.validateTimeFormat(startTime);
        this.validateTimeFormat(endTime);
        
        if (startTime >= endTime) {
          throw new BadRequestException('Modified end time must be after start time');
        }
      }
      
      // Apply updates
      Object.assign(exception, updateExceptionDto);
      exception.updatedAt = new Date();
      
      const updatedException = await exception.save();
      
      return {
        data: updatedException,
        message: 'Schedule exception updated successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error updating schedule exception ${id}:`, error);
      throw new InternalServerErrorException('Failed to update schedule exception');
    }
  }

  async remove(id: string) {
    try {
      const exception = await this.exceptionModel.findByIdAndDelete(id);
      
      if (!exception) {
        throw new NotFoundException(`Schedule exception with ID ${id} not found`);
      }
      
      return {
        data: exception,
        message: 'Schedule exception deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error deleting schedule exception ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete schedule exception');
    }
  }

  async checkExceptionsForBookingTime(
    vendorId: string, 
    bookingItemId: string,
    roleIds: string[],
    date: Date
  ) {
    try {
      // Get the date part only
      const exceptionDate = new Date(date);
      exceptionDate.setHours(0, 0, 0, 0);
      
      // Find any exceptions for this date and vendor
      const exceptions = await this.exceptionModel.find({
        vendorId,
        date: exceptionDate
      }).exec();
      
      if (exceptions.length === 0) {
        return {
          hasExceptions: false,
          exceptions: []
        };
      }
      
      // Find exceptions that affect this booking
      const relevantExceptions = exceptions.filter(exception => {
        // Check if it affects the entire vendor (no specific roles or booking items)
        if (
          exception.affectedRoleIds.length === 0 && 
          exception.affectedBookingItemIds.length === 0
        ) {
          return true;
        }
        
        // Check if it affects any of the roles
        if (
          exception.affectedRoleIds.length > 0 && 
          roleIds.some(roleId => exception.affectedRoleIds.includes(roleId))
        ) {
          return true;
        }
        
        // Check if it affects the booking item
        if (
          exception.affectedBookingItemIds.length > 0 && 
          exception.affectedBookingItemIds.includes(bookingItemId)
        ) {
          return true;
        }
        
        return false;
      });
      
      return {
        hasExceptions: relevantExceptions.length > 0,
        exceptions: relevantExceptions
      };
    } catch (error) {
      console.error('Error checking exceptions for booking time:', error);
      throw new InternalServerErrorException('Failed to check schedule exceptions');
    }
  }

  private validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new BadRequestException('Invalid time format. Must be HH:MM in 24-hour format');
    }
  }
}