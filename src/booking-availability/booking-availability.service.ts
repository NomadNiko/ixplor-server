import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StaffUserService } from '../staff-user/staff-user.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { TimeSlotRequestDto, TimeSlotResponseDto } from './dto/time-slot-request.dto';
import { BookingRequestValidationDto, BookingValidationResponseDto } from './dto/booking-request-validation.dto';
import { AvailableStaffDto } from './dto/available-staff.dto';

@Injectable()
export class BookingAvailabilityService {
  constructor(
    private readonly staffUserService: StaffUserService,
    private readonly bookingItemService: BookingItemService
  ) {}

  async getAvailableTimeSlots(
    bookingItemId: string,
    request: TimeSlotRequestDto
  ): Promise<TimeSlotResponseDto> {
    const bookingItem = await this.bookingItemService.findById(bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    const qualifiedStaff = await this.staffUserService.findQualifiedForBookingItem(
      bookingItemId,
      bookingItem.data.vendorId
    );

    const availableSlots = this.calculateAvailableTimeSlots(
      qualifiedStaff.data,
      request.date,
      bookingItem.data.duration,
      request.timePreference
    );

    return {
      availableTimeSlots: availableSlots,
      totalSlots: availableSlots.length,
      slotsBreakdown: this.calculateSlotsBreakdown(availableSlots),
      availableStaffIds: qualifiedStaff.data.map(staff => staff._id)
    };
  }

  async validateBookingRequest(
    request: BookingRequestValidationDto
  ): Promise<BookingValidationResponseDto> {
    const bookingItem = await this.bookingItemService.findById(request.bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    const availableStaff = await this.findAvailableStaff(
      request.bookingItemId,
      request.startDateTime
    );

    const isAvailable = availableStaff.length > 0;
    let alternativeTimeSlots: Date[] | undefined;

    if (!isAvailable) {
      alternativeTimeSlots = await this.findAlternativeTimeSlots(
        request.bookingItemId,
        request.startDateTime,
        request.duration
      );
    }

    return {
      isAvailable,
      availableStaffCount: availableStaff.length,
      availableStaffIds: availableStaff.map(staff => staff.staffId),
      reason: !isAvailable ? 'No qualified staff available at requested time' : undefined,
      alternativeTimeSlots
    };
  }

  async findAvailableStaff(
    bookingItemId: string,
    startDateTime: Date
  ): Promise<AvailableStaffDto[]> {
    const bookingItem = await this.bookingItemService.findById(bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    const qualifiedStaff = await this.staffUserService.findQualifiedForBookingItem(
      bookingItemId,
      bookingItem.data.vendorId
    );

    const availableStaff: AvailableStaffDto[] = [];
    
    for (const staff of qualifiedStaff.data) {
      const availability = this.checkStaffAvailability(
        staff,
        startDateTime,
        bookingItem.data.duration
      );

      if (availability.isAvailable) {
        availableStaff.push({
          staffId: staff._id,
          name: staff.name,
          availableSlots: availability.availableSlots,
          isQualified: true,
          currentBookings: staff.bookedObjects.length,
          maxDailyBookings: this.calculateMaxDailyBookings(staff),
          qualifications: staff.qualifiedProducts
        });
      }
    }

    return availableStaff;
  }

  async getAvailableTimeSlotsForDate(
    bookingItemId: string,
    date: Date
  ): Promise<TimeSlotResponseDto> {
    const bookingItem = await this.bookingItemService.findById(bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    // Fix timezone issues by ensuring the date is interpreted correctly
    // Create a date that preserves the year, month, and day regardless of timezone
    const dateParts = date.toISOString().split('T')[0].split('-');
    const fixedDate = new Date(
      parseInt(dateParts[0]), 
      parseInt(dateParts[1]) - 1, // Month is 0-indexed in JavaScript
      parseInt(dateParts[2])
    );

    return this.getAvailableTimeSlots(bookingItemId, {
      bookingItemId,
      date: fixedDate,
      duration: bookingItem.data.duration 
    });
  }

  async getAvailableTimeSlotsExcludingBooking(
    bookingItemId: string,
    date: Date,
    excludeBookingId: string
  ): Promise<TimeSlotResponseDto> {
    // Get current booking data to later exclude it from time slot calculations
    const bookingInfo = await this.findBookingById(excludeBookingId);
    
    // Fix timezone issues by ensuring the date is interpreted correctly
    const dateParts = date.toISOString().split('T')[0].split('-');
    const fixedDate = new Date(
      parseInt(dateParts[0]), 
      parseInt(dateParts[1]) - 1, // Month is 0-indexed in JavaScript
      parseInt(dateParts[2])
    );
    
    const response = await this.getAvailableTimeSlotsForDate(bookingItemId, fixedDate);
    
    // If we have the booking that we're excluding, we should add its time slot 
    // as an available time if it's on the requested date
    if (bookingInfo) {
      const bookingDate = new Date(bookingInfo.startDateTime);
      const bookingDateStr = `${bookingDate.getFullYear()}-${bookingDate.getMonth() + 1}-${bookingDate.getDate()}`;
      const fixedDateStr = `${fixedDate.getFullYear()}-${fixedDate.getMonth() + 1}-${fixedDate.getDate()}`;
      
      if (bookingDateStr === fixedDateStr) {
        response.availableTimeSlots.push(bookingDate);
        response.availableTimeSlots.sort((a, b) => a.getTime() - b.getTime());
        response.totalSlots = response.availableTimeSlots.length;
        response.slotsBreakdown = this.calculateSlotsBreakdown(response.availableTimeSlots);
      }
    }
    
    return response;
  }

  async validateStaffAvailability(
    staffId: string,
    startDateTime: Date,
    duration: number
  ): Promise<boolean> {
    const staff = await this.staffUserService.findById(staffId);
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const availability = this.checkStaffAvailability(
      staff.data,
      startDateTime,
      duration
    );

    return availability.isAvailable;
  }

  private calculateAvailableTimeSlots(
    staff: any[],
    date: Date,
    duration: number,
    timePreference?: string
  ): Date[] {
    // Ensure we're working with the correct date by fixing timezone issues
    // We want to use the date parts directly rather than creating a new Date
    // which could be affected by timezone
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Initialize date with just the date part (no time) in local timezone
    const requestedDate = new Date(year, month, day, 0, 0, 0, 0);
    
    // Create the next day date for comparison
    const nextDay = new Date(year, month, day + 1, 0, 0, 0, 0);
    
    // Store all possible time slots
    const allTimeSlots: Date[] = [];
    
    // For each staff member, check their availability throughout the day
    for (const staffMember of staff) {
      // Get the shifts for this staff member on the requested date
      const shiftsForDay = staffMember.shifts.filter(shift => {
        const shiftStart = new Date(shift.startDateTime);
        const shiftEnd = new Date(shift.endDateTime);
        return shiftStart < nextDay && shiftEnd > requestedDate;
      });
      
      // For each shift, calculate available time slots
      for (const shift of shiftsForDay) {
        const shiftStart = new Date(shift.startDateTime);
        const shiftEnd = new Date(shift.endDateTime);
        
        // Adjust shift start if it begins before the requested date
        const effectiveShiftStart = shiftStart < requestedDate ? requestedDate : shiftStart;
        
        // Adjust shift end if it ends after the next day
        const effectiveShiftEnd = shiftEnd > nextDay ? nextDay : shiftEnd;
        
        // Calculate all possible starting times in 30-minute increments
        const effectiveStartTime = new Date(effectiveShiftStart);
        
        while (effectiveStartTime.getTime() + (duration * 60 * 1000) <= effectiveShiftEnd.getTime()) {
          // Check if this time slot conflicts with any existing bookings
          const endTime = new Date(effectiveStartTime.getTime() + (duration * 60 * 1000));
          const hasConflict = staffMember.bookedObjects.some(booking => {
            // Skip cancelled bookings
            if (booking.status === 'CANCELLED') return false;
            
            const bookingStart = new Date(booking.startDateTime);
            const bookingEnd = new Date(bookingStart.getTime() + (booking.duration * 60 * 1000));
            
            // Check for time overlap
            return (effectiveStartTime < bookingEnd && endTime > bookingStart);
          });
          
          // If no conflict, add this time slot to the list
          if (!hasConflict) {
            allTimeSlots.push(new Date(effectiveStartTime));
          }
          
          // Move to the next 30-minute slot
          effectiveStartTime.setMinutes(effectiveStartTime.getMinutes() + 30);
        }
      }
    }
    
    // Remove duplicate time slots
    const uniqueTimeSlots = Array.from(new Set(allTimeSlots.map(time => time.getTime())))
      .map(timestamp => new Date(timestamp));
    
    // Sort by time
    uniqueTimeSlots.sort((a, b) => a.getTime() - b.getTime());
    
    // Filter by time preference if specified
    if (timePreference) {
      return this.filterByTimePreference(uniqueTimeSlots, timePreference);
    }
    
    return uniqueTimeSlots;
  }

  private filterByTimePreference(timeSlots: Date[], preference: string): Date[] {
    return timeSlots.filter(slot => {
      const hour = slot.getHours();
      
      switch (preference.toUpperCase()) {
        case 'MORNING':
          return hour < 12;
        case 'AFTERNOON':
          return hour >= 12 && hour < 17;
        case 'EVENING':
          return hour >= 17;
        default:
          return true; // If preference is 'ANY' or invalid, return all slots
      }
    });
  }

  private calculateSlotsBreakdown(slots: Date[]): Record<string, number> {
    const breakdown: Record<string, number> = {
      MORNING: 0,
      AFTERNOON: 0,
      EVENING: 0
    };

    slots.forEach(slot => {
      const hour = slot.getHours();
      if (hour < 12) breakdown.MORNING++;
      else if (hour < 17) breakdown.AFTERNOON++;
      else breakdown.EVENING++;
    });

    return breakdown;
  }

  private checkStaffAvailability(
    staff: any,
    startDateTime: Date,
    duration: number
  ): { isAvailable: boolean; availableSlots: { startTime: Date; endTime: Date }[] } {
    const bookingEndTime = new Date(startDateTime.getTime() + duration * 60000);
    const startDate = new Date(startDateTime);
    startDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Check if there's a shift that covers the requested time
    const hasShift = staff.shifts.some(shift => {
      const shiftStart = new Date(shift.startDateTime);
      const shiftEnd = new Date(shift.endDateTime);
      return shiftStart <= startDateTime && shiftEnd >= bookingEndTime;
    });
    
    if (!hasShift) {
      return { isAvailable: false, availableSlots: [] };
    }
    
    // Check for booking conflicts
    const hasConflict = staff.bookedObjects.some(booking => {
      if (booking.status === 'CANCELLED') return false;
      
      const bookingStart = new Date(booking.startDateTime);
      const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
      
      return startDateTime < bookingEnd && bookingEndTime > bookingStart;
    });
    
    if (hasConflict) {
      return { isAvailable: false, availableSlots: [] };
    }
    
    // Calculate all available slots for the day
    const availableSlots: { startTime: Date; endTime: Date }[] = [];
    
    // Get all shifts for the day
    const dayShifts = staff.shifts.filter(shift => {
      const shiftStart = new Date(shift.startDateTime);
      const shiftEnd = new Date(shift.endDateTime);
      return shiftStart < nextDay && shiftEnd > startDate;
    });
    
    // For each shift, calculate available slots
    for (const shift of dayShifts) {
      const shiftStart = new Date(Math.max(new Date(shift.startDateTime).getTime(), startDate.getTime()));
      const shiftEnd = new Date(Math.min(new Date(shift.endDateTime).getTime(), nextDay.getTime()));
      
      // Add the whole shift as an available slot
      availableSlots.push({
        startTime: shiftStart,
        endTime: shiftEnd
      });
    }
    
    return { 
      isAvailable: true, 
      availableSlots 
    };
  }

  private calculateMaxDailyBookings(staff: any): number {
    // Calculate max daily bookings based on shift duration and typical booking length
    // This is a simple implementation - could be more sophisticated
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get all shifts for today
    const todayShifts = staff.shifts.filter(shift => {
      const shiftStart = new Date(shift.startDateTime);
      const shiftEnd = new Date(shift.endDateTime);
      return shiftStart < tomorrow && shiftEnd > today;
    });
    
    // Calculate total minutes available today
    let totalMinutes = 0;
    for (const shift of todayShifts) {
      const shiftStart = new Date(Math.max(new Date(shift.startDateTime).getTime(), today.getTime()));
      const shiftEnd = new Date(Math.min(new Date(shift.endDateTime).getTime(), tomorrow.getTime()));
      totalMinutes += (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
    }
    
    // Assuming average booking is 60 minutes
    const averageBookingLength = 60;
    
    // Allow some buffer time between bookings
    const bufferMinutes = 15;
    
    return Math.floor(totalMinutes / (averageBookingLength + bufferMinutes));
  }

  private async findAlternativeTimeSlots(
    bookingItemId: string,
    startDateTime: Date,
    duration: number
  ): Promise<Date[]> {
    // Look for alternative slots in the next 7 days
    const alternatives: Date[] = [];
    const currentDate = new Date(startDateTime);
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 7; i++) {
      // Skip the first day if it's the same as the requested date
      if (i > 0 || currentDate.getDate() !== startDateTime.getDate()) {
        const availableSlots = await this.getAvailableTimeSlotsForDate(
          bookingItemId,
          new Date(currentDate)
        );
        
        if (availableSlots.availableTimeSlots.length > 0) {
          alternatives.push(...availableSlots.availableTimeSlots);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return alternatives;
  }

  // Helper method to find a booking by ID
  private async findBookingById(bookingId: string): Promise<any | null> {
    const staffWithBooking = await this.staffUserService.findStaffWithBooking(bookingId);
    if (!staffWithBooking) {
      return null;
    }
    
    const booking = staffWithBooking.bookedObjects.find(b => b.bookingId === bookingId);
    if (!booking) {
      return null;
    }
    
    return {
      ...booking,
      staffId: staffWithBooking._id,
      staffName: staffWithBooking.name
    };
  }
}