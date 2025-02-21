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
    // Verify booking item exists
    const bookingItem = await this.bookingItemService.findById(bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    // Get all qualified staff
    const qualifiedStaff = await this.staffUserService.findQualifiedForBookingItem(
      bookingItemId,
      bookingItem.data.vendorId
    );

    // Calculate available slots based on staff shifts and existing bookings
    const availableSlots = await this.calculateAvailableTimeSlots(
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
    // Check if booking item exists and get details
    const bookingItem = await this.bookingItemService.findById(request.bookingItemId);
    if (!bookingItem) {
      throw new NotFoundException('Booking item not found');
    }

    // Find available staff for the requested time
    const availableStaff = await this.findAvailableStaff(
      request.bookingItemId,
      request.startDateTime
    );

    const isAvailable = availableStaff.length > 0;
    let alternativeTimeSlots: Date[] | undefined;

    if (!isAvailable) {
      // Get alternative slots if requested time is not available
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

    // Get all qualified staff
    const qualifiedStaff = await this.staffUserService.findQualifiedForBookingItem(
      bookingItemId,
      bookingItem.data.vendorId
    );

    // Filter for available staff at the requested time
    const availableStaff: AvailableStaffDto[] = [];
    for (const staff of qualifiedStaff.data) {
      const availability = await this.checkStaffAvailability(
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
    return this.getAvailableTimeSlots(bookingItemId, {
      bookingItemId,
      date,
      duration: 30 // Default duration, should be obtained from booking item
    });
  }

  async getAvailableTimeSlotsExcludingBooking(
    bookingItemId: string,
    date: Date,
    excludeBookingId: string
  ): Promise<TimeSlotResponseDto> {
    // Similar to getAvailableTimeSlots but excludes a specific booking
    // Useful for finding alternative slots when rescheduling
    const response = await this.getAvailableTimeSlotsForDate(bookingItemId, date);
    // Additional logic to exclude the specified booking and recalculate
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

    const availability = await this.checkStaffAvailability(
      staff.data,
      startDateTime,
      duration
    );

    return availability.isAvailable;
  }

  private async calculateAvailableTimeSlots(
    staff: any[],
    date: Date,
    duration: number,
    timePreference?: string
  ): Promise<Date[]> {
    // Implement a minimal async implementation
    return Promise.resolve([]);
  }

  private calculateSlotsBreakdown(slots: Date[]): Record<string, number> {
    // Group slots by time of day and count
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

  private async checkStaffAvailability(
    staff: any,
    startDateTime: Date,
    duration: number
  ): Promise<{ isAvailable: boolean; availableSlots: { startTime: Date; endTime: Date }[] }> {
    // Implement a minimal async implementation
    return Promise.resolve({ isAvailable: false, availableSlots: [] });
  }
  
 
  private calculateMaxDailyBookings(staff: any): number {
    // Calculate max bookings based on shift duration and standard booking length
    return 8; // Placeholder
  }

  private async findAlternativeTimeSlots(
    bookingItemId: string,
    startDateTime: Date,
    duration: number
  ): Promise<Date[]> {
    // Implement a minimal async implementation
    return Promise.resolve([]);
  }
}