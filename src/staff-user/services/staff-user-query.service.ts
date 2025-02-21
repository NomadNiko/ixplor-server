import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import {
  StaffUserSchemaClass,
  StaffUserSchemaDocument,
  StaffUserStatusEnum
} from '../infrastructure/persistence/document/entities/staff-user.schema';
import { StaffUserTransformService } from './staff-user-transform.service';
import { StaffWorkloadDto, StaffAvailabilityDto } from '../types/staff-user.interfaces';

@Injectable()
export class StaffUserQueryService {
  constructor(
    @InjectModel(StaffUserSchemaClass.name)
    private readonly staffUserModel: Model<StaffUserSchemaDocument>,
    private readonly transformService: StaffUserTransformService,
  ) {}

  async findAll() {
    const staffUsers = await this.staffUserModel
      .find()
      .select('-__v')
      .lean()
      .exec();
    return {
      data: staffUsers.map(staff => this.transformService.transformStaffUserResponse(staff)),
    };
  }

  async findById(id: string) {
    const staffUser = await this.staffUserModel
      .findById(id)
      .select('-__v')
      .lean()
      .exec();
    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }
    return {
      data: this.transformService.transformStaffUserResponse(staffUser),
    };
  }

  async findByVendor(vendorId: string) {
    const staffUsers = await this.staffUserModel
      .find({ vendorId })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: staffUsers.map(staff => this.transformService.transformStaffUserResponse(staff)),
    };
  }

  async findActiveByVendor(vendorId: string) {
    const staffUsers = await this.staffUserModel
      .find({
        vendorId,
        status: StaffUserStatusEnum.ACTIVE
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: staffUsers.map(staff => this.transformService.transformStaffUserResponse(staff)),
    };
  }

  async findQualifiedForBookingItem(bookingItemId: string, vendorId: string) {
    const staffUsers = await this.staffUserModel
      .find({
        vendorId,
        qualifiedProducts: bookingItemId,
        status: StaffUserStatusEnum.ACTIVE
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: staffUsers.map(staff => this.transformService.transformStaffUserResponse(staff)),
    };
  }

  async getStaffWorkload(staffId: string, date: Date): Promise<StaffWorkloadDto> {
    const staff = await this.staffUserModel.findById(staffId);
    if (!staff) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }

    // Normalize the date to midnight
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(queryDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Filter bookings for the given date
    const dateBookings = staff.bookedObjects.filter(booking => {
      const bookingDate = new Date(booking.startDateTime);
      return bookingDate >= queryDate && bookingDate < nextDay;
    });

    const totalBookings = dateBookings.length;
    const completedBookings = dateBookings.filter(b => b.status === 'COMPLETED').length;
    const pendingBookings = dateBookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status)).length;

    // Calculate hourly time slots
    const timeSlots: Array<{
        hour: number;
        isBooked: boolean;
        bookingId?: string;
      }> = [];
      
      for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(queryDate);
      hourStart.setHours(hour, 0, 0, 0);
      
      const hasBooking = dateBookings.some(booking => {
        const bookingStart = new Date(booking.startDateTime);
        const bookingEnd = new Date(booking.startDateTime.getTime() + booking.duration * 60000);
        return (
          bookingStart.getHours() <= hour && 
          bookingEnd.getHours() > hour &&
          booking.status !== 'CANCELLED'
        );
      });

      const booking = dateBookings.find(booking => {
        const bookingStart = new Date(booking.startDateTime);
        const bookingEnd = new Date(booking.startDateTime.getTime() + booking.duration * 60000);
        return (
          bookingStart.getHours() <= hour && 
          bookingEnd.getHours() > hour &&
          booking.status !== 'CANCELLED'
        );
      });

      timeSlots.push({
        hour,
        isBooked: hasBooking,
        bookingId: booking?.bookingItemId
      });
    }
  

    // Calculate utilization rate based on shift hours
    let shiftMinutes = 0;
    let bookedMinutes = 0;

    // Get shifts for this day
    const shifts = staff.shifts.filter(shift => {
      const shiftDate = new Date(shift.startDateTime);
      const shiftEndDate = new Date(shift.endDateTime);
      return (
        (shiftDate >= queryDate && shiftDate < nextDay) || 
        (shiftEndDate > queryDate && shiftEndDate <= nextDay) ||
        (shiftDate < queryDate && shiftEndDate > nextDay)
      );
    });

    // Calculate total minutes in shifts for this day
    shifts.forEach(shift => {
      const shiftStart = new Date(Math.max(shift.startDateTime.getTime(), queryDate.getTime()));
      const shiftEnd = new Date(Math.min(shift.endDateTime.getTime(), nextDay.getTime()));
      shiftMinutes += (shiftEnd.getTime() - shiftStart.getTime()) / 60000;
    });

    // Calculate total booked minutes
    dateBookings.forEach(booking => {
      if (booking.status !== 'CANCELLED') {
        const bookingStart = new Date(booking.startDateTime);
        const bookingEnd = new Date(booking.startDateTime.getTime() + booking.duration * 60000);
        
        // Adjust booking time to be within the day if it spans multiple days
        const adjustedStart = new Date(Math.max(bookingStart.getTime(), queryDate.getTime()));
        const adjustedEnd = new Date(Math.min(bookingEnd.getTime(), nextDay.getTime()));
        
        bookedMinutes += (adjustedEnd.getTime() - adjustedStart.getTime()) / 60000;
      }
    });

    const utilizationRate = shiftMinutes > 0 ? (bookedMinutes / shiftMinutes) * 100 : 0;

    return {
      staffId,
      date: queryDate,
      totalBookings,
      completedBookings,
      pendingBookings,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      timeSlots
    };
  }

  async findStaffWithBooking(bookingId: string) {
    const staffUser = await this.staffUserModel.findOne({
      'bookedObjects.bookingId': bookingId
    }).lean();

    if (!staffUser) {
      return null;
    }

    return this.transformService.transformStaffUserResponse(staffUser);
  }

  async getAvailableStaff(
    bookingItemId: string,
    startDateTime: Date,
    duration: number
  ): Promise<StaffAvailabilityDto[]> {
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    
    // Find staff who are qualified for this booking item
    const staffUsers = await this.staffUserModel.find({
      qualifiedProducts: bookingItemId,
      status: StaffUserStatusEnum.ACTIVE
    }).exec();

    const availableStaff: StaffAvailabilityDto[] = [];

    for (const staff of staffUsers) {
      // Check if staff has a shift that covers the booking time
      const hasShift = staff.shifts.some(shift => 
        shift.startDateTime <= startDateTime && 
        shift.endDateTime >= endDateTime
      );

      if (!hasShift) continue;

      // Check for booking conflicts
      const hasConflict = staff.bookedObjects.some(booking => {
        if (booking.status === 'CANCELLED') return false;
        
        const bookingStart = new Date(booking.startDateTime);
        const bookingEnd = new Date(booking.startDateTime.getTime() + booking.duration * 60000);
        
        return (
          (startDateTime < bookingEnd && endDateTime > bookingStart) // Overlapping time ranges
        );
      });

      if (!hasConflict) {
        // Determine all available time slots for the day
        const day = new Date(startDateTime);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        // Find shifts for this day
        const dayShifts = staff.shifts.filter(shift =>
          (shift.startDateTime >= day && shift.startDateTime < nextDay) ||
          (shift.endDateTime > day && shift.endDateTime <= nextDay) ||
          (shift.startDateTime < day && shift.endDateTime > nextDay)
        );

        // Get bookings for this day
        const dayBookings = staff.bookedObjects.filter(booking => {
          if (booking.status === 'CANCELLED') return false;
          const bookingDate = new Date(booking.startDateTime);
          return bookingDate >= day && bookingDate < nextDay;
        });

        // Calculate available time slots
        const availableTimeSlots: Array<{
            startTime: Date;
            endTime: Date;
          }> = [];
        for (const shift of dayShifts) {
          const shiftStart = new Date(Math.max(shift.startDateTime.getTime(), day.getTime()));
          const shiftEnd = new Date(Math.min(shift.endDateTime.getTime(), nextDay.getTime()));

          // Check each 30-minute increment within the shift
          for (let time = shiftStart.getTime(); time < shiftEnd.getTime(); time += 30 * 60000) {
            const slotStart = new Date(time);
            const slotEnd = new Date(time + duration * 60000);

            // Skip if this slot extends beyond the shift
            if (slotEnd > shiftEnd) continue;

            // Check if this slot conflicts with any booking
            const slotHasConflict = dayBookings.some(booking => {
              const bookingStart = new Date(booking.startDateTime);
              const bookingEnd = new Date(booking.startDateTime.getTime() + booking.duration * 60000);
              return (slotStart < bookingEnd && slotEnd > bookingStart);
            });

            if (!slotHasConflict) {
                availableTimeSlots.push({
                  startTime: slotStart,
                  endTime: slotEnd
                });
              }
            }
        }

         

        availableStaff.push({
          staffId: staff._id.toString(),
          name: staff.name,
          availableTimeSlots,
          qualifiedForBookingItem: true,
          currentWorkload: staff.bookedObjects.filter(b => 
            b.status !== 'CANCELLED' && 
            b.status !== 'COMPLETED'
          ).length
        });
      }
    }

    return availableStaff;
  }
}