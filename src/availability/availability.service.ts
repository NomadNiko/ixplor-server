// src/availability/availability.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoleShiftSchemaClass } from '../role-shift/infrastructure/persistence/document/entities/role-shift.schema';
import { StaffRoleSchemaClass } from '../staff-role/infrastructure/persistence/document/entities/staff-role.schema';
import { StaffScheduleSchemaClass, StaffScheduleStatusEnum } from '../staff-schedule/infrastructure/persistence/document/entities/staff-schedule.schema';
import { BookingCalendarSchemaClass, BookingStatusEnum } from '../booking-calendar/infrastructure/persistence/document/entities/booking-calendar.schema';
import { ScheduleExceptionSchemaClass, ExceptionTypeEnum } from '../schedule-exception/infrastructure/persistence/document/entities/schedule-exception.schema';
import { BookingItemService } from '../booking-item/booking-item.service';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(RoleShiftSchemaClass.name)
    private readonly roleShiftModel: Model<RoleShiftSchemaClass>,
    
    @InjectModel(StaffRoleSchemaClass.name)
    private readonly staffRoleModel: Model<StaffRoleSchemaClass>,
    
    @InjectModel(StaffScheduleSchemaClass.name)
    private readonly staffScheduleModel: Model<StaffScheduleSchemaClass>,
    
    @InjectModel(BookingCalendarSchemaClass.name)
    private readonly bookingCalendarModel: Model<BookingCalendarSchemaClass>,
    
    @InjectModel(ScheduleExceptionSchemaClass.name)
    private readonly scheduleExceptionModel: Model<ScheduleExceptionSchemaClass>,
    
    private readonly bookingItemService: BookingItemService,
  ) {}

  

  async getAvailableSlotsForBookingItem(
    bookingItemId: string,
    date: Date,
    duration?: number
  ) {
    // Verify the booking item exists
    const bookingItem = await this.bookingItemService.findById(bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException(`Booking item with ID ${bookingItemId} not found`);
    }

    // If duration not provided, use the booking item's default duration
    const bookingDuration = duration || bookingItem.data.duration;
    
    // Get roles qualified for this booking item
    const qualifiedRoles = await this.staffRoleModel.find({
      qualifiedBookingItems: bookingItemId,
      isActive: true
    }).exec();

    if (qualifiedRoles.length === 0) {
      return {
        availableSlots: [],
        message: 'No qualified roles found for this booking item'
      };
    }

    const qualifiedRoleIds = qualifiedRoles.map(role => role._id.toString());

    // Get the day of week for the requested date
    const dayOfWeek = date.getDay();
    
    // Check for schedule exceptions on this date
    const exceptions = await this.scheduleExceptionModel.find({
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      },
      $or: [
        { affectedRoleIds: { $in: qualifiedRoleIds } },
        { affectedBookingItemIds: bookingItemId }
      ]
    }).exec();

    // Get role shifts for this day of week
    const roleShifts = await this.roleShiftModel.find({
      roleId: { $in: qualifiedRoleIds },
      dayOfWeek,
      isActive: true,
      $or: [
        { applicableBookingItems: { $size: 0 } }, // Empty array means all qualified items
        { applicableBookingItems: bookingItemId }
      ]
    }).exec();

    if (roleShifts.length === 0) {
      return {
        availableSlots: [],
        message: 'No role shifts found for this day'
      };
    }

    // Get existing bookings for these roles on this date
    const existingBookings = await this.bookingCalendarModel.find({
      roleId: { $in: qualifiedRoleIds },
      startDateTime: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      },
      status: { $nin: [BookingStatusEnum.CANCELLED] }
    }).exec();

    const availableSlots: Array<{
        startTime: Date;
        endTime: Date;
        roleId: string;
        availableCapacity: number;
      }> = [];
      
    for (const shift of roleShifts) {
      // Check if this shift is affected by any exceptions
      const shiftException = exceptions.find(ex => 
        ex.affectedRoleIds.includes(shift.roleId) && 
        ex.exceptionType === ExceptionTypeEnum.CLOSED
      );
      
      if (shiftException) {
        continue; // Skip this shift if there's a closure exception
      }

      // Get the role for this shift to check capacity
      const role = qualifiedRoles.find(r => r._id.toString() === shift.roleId);

      const capacity = shift.capacity || (role ? role.defaultCapacity : 1);
            
      // Convert shift times to date objects for the selected date
      const [startHour, startMinute] = shift.startTime.split(':').map(Number);
      const [endHour, endMinute] = shift.endTime.split(':').map(Number);
      
      const shiftStart = new Date(date);
      shiftStart.setHours(startHour, startMinute, 0, 0);
      
      const shiftEnd = new Date(date);
      shiftEnd.setHours(endHour, endMinute, 0, 0);
      
      // Iterate through possible timeslots (in 30 min increments)
      for (let slotTime = shiftStart.getTime(); slotTime <= shiftEnd.getTime() - (bookingDuration * 60 * 1000); slotTime += 30 * 60 * 1000) {
        const slotStart = new Date(slotTime);
        const slotEnd = new Date(slotTime + (bookingDuration * 60 * 1000));
        
        // Count bookings that overlap with this slot
        const overlappingBookings = existingBookings.filter(booking => {
          const bookingStart = new Date(booking.startDateTime);
          const bookingEnd = new Date(booking.startDateTime.getTime() + (booking.duration * 60 * 1000));
          
          return (
            booking.roleId === shift.roleId &&
            slotStart < bookingEnd && 
            slotEnd > bookingStart
          );
        });
        
        // Check if slot is available (bookings count < capacity)
        if (overlappingBookings.length < capacity) {
          availableSlots.push({
            startTime: slotStart,
            endTime: slotEnd,
            roleId: shift.roleId,
            availableCapacity: capacity - overlappingBookings.length
          });
        }
      }
    }
    
    // Sort slots by start time
    availableSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    return {
      availableSlots,
      message: availableSlots.length > 0 
        ? `Found ${availableSlots.length} available time slots`
        : 'No available time slots found'
    };
  }

  async validateBookingRequest(
    bookingItemId: string,
    roleId: string,
    startDateTime: Date,
    duration: number
  ) {
    // Check if the role exists and is qualified for this booking item
    const role = await this.staffRoleModel.findById(roleId).exec();
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }
    
    if (!role.qualifiedBookingItems.includes(bookingItemId)) {
      throw new BadRequestException('Role is not qualified for this booking item');
    }
    
    // Calculate booking end time
    const endDateTime = new Date(startDateTime.getTime() + (duration * 60 * 1000));
    
    // Check for schedule exceptions
    const date = new Date(startDateTime);
    date.setHours(0, 0, 0, 0);
    
    const exception = await this.scheduleExceptionModel.findOne({
      date,
      $or: [
        { affectedRoleIds: roleId },
        { affectedBookingItemIds: bookingItemId }
      ],
      exceptionType: ExceptionTypeEnum.CLOSED
    }).exec();
    
    if (exception) {
      return {
        isValid: false,
        message: `Booking not available due to: ${exception.description}`
      };
    }
    
    // Check if time falls within a role shift
    const dayOfWeek = startDateTime.getDay();
    const timeString = this.formatTimeFromDate(startDateTime);
    const endTimeString = this.formatTimeFromDate(endDateTime);
    
    const shift = await this.roleShiftModel.findOne({
      roleId,
      dayOfWeek,
      startTime: { $lte: timeString },
      endTime: { $gte: endTimeString },
      isActive: true,
      $or: [
        { applicableBookingItems: { $size: 0 } },
        { applicableBookingItems: bookingItemId }
      ]
    }).exec();
    
    if (!shift) {
      return {
        isValid: false,
        message: 'No active role shift covers the requested time'
      };
    }
    
    // Check role capacity
    const capacity = shift.capacity || role.defaultCapacity;
    
    // Count existing bookings for this role at this time
    const overlappingBookings = await this.bookingCalendarModel.countDocuments({
      roleId,
      status: { $nin: [BookingStatusEnum.CANCELLED] },
      $or: [
        {
          startDateTime: { $lt: endDateTime },
          $expr: {
            $gt: [
              { $add: ['$startDateTime', { $multiply: ['$duration', 60000] }] },
              startDateTime.getTime()
            ]
          }
        }
      ]
    }).exec();
    
    if (overlappingBookings >= capacity) {
      return {
        isValid: false,
        message: 'Role capacity is full for the requested time'
      };
    }
    
    // Optional: Check if a staff member is assigned to this role for near-term bookings
    const isNearTerm = startDateTime.getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000; // 14 days
    
    if (isNearTerm) {
      const staffAssignment = await this.staffScheduleModel.findOne({
        roleId,
        date,
        startTime: { $lte: timeString },
        endTime: { $gte: endTimeString },
        status: StaffScheduleStatusEnum.PUBLISHED
      }).exec();
      
      if (!staffAssignment) {
        return {
          isValid: true,
          requiresStaffing: true,
          message: 'Booking is valid but no staff is currently assigned to this role'
        };
      }
    }
    
    return {
      isValid: true,
      message: 'Booking request is valid'
    };
  }

  private formatTimeFromDate(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}