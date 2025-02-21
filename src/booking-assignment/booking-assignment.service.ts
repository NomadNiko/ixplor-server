import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StaffUserService } from '../staff-user/staff-user.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { BookingAvailabilityService } from '../booking-availability/booking-availability.service';
import { BookingDetailsDto } from './dto/booking-details.dto';
import { BookedObject, BookingAssignmentResponse, SingleBookingResponse } from './types/booking-assignment.types';

@Injectable()
export class BookingAssignmentService {
  constructor(
    private readonly staffUserService: StaffUserService,
    private readonly bookingItemService: BookingItemService,
    private readonly bookingAvailabilityService: BookingAvailabilityService
  ) {}

  async validateReassignmentPermission(userId: string, bookingId: string): Promise<boolean> {
    // Placeholder for permission validation logic
    // Check if user is admin or associated with the vendor
    return Promise.resolve(true);
  }

  async reassignBooking(bookingId: string, newStaffId: string): Promise<SingleBookingResponse> {
    const booking = await this.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isAvailable = await this.bookingAvailabilityService.validateStaffAvailability(
      newStaffId,
      booking.startDateTime,
      booking.duration
    );

    if (!isAvailable) {
      throw new BadRequestException('Staff member is not available for this time slot');
    }

    const updatedBooking = await this.staffUserService.reassignBooking(bookingId, booking.staffId, newStaffId);
    return { data: updatedBooking };
  }

  async findAvailableStaffForReassignment(bookingId: string) {
    const booking = await this.findBookingById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.bookingAvailabilityService.findAvailableStaff(
      booking.bookingItemId,
      booking.startDateTime
    );
  }

  async getBookingsByDate(vendorId: string, date: Date, status?: string): Promise<BookingAssignmentResponse> {
    const staffMembers = await this.staffUserService.findByVendor(vendorId);
    
    const bookings: BookedObject[] = [];
    for (const staff of staffMembers.data) {
      const staffBookings = staff.bookedObjects.filter(booking => {
        const bookingDate = new Date(booking.startDateTime);
        return (
          bookingDate.toDateString() === date.toDateString() &&
          (!status || booking.status === status)
        );
      });

      bookings.push(...staffBookings.map(booking => ({
        ...booking,
        staffId: staff._id,
        staffName: staff.name
      })));
    }

    return {
      data: bookings.sort((a, b) => 
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
      )
    };
  }

  async getBookingDetails(bookingId: string): Promise<BookingDetailsDto | null> {
    const booking = await this.findBookingById(bookingId);
    if (!booking) {
      return null;
    }

    const staff = await this.staffUserService.findById(booking.staffId);
    if (!staff) {
      return null;
    }

    const bookingItem = await this.bookingItemService.findById(booking.bookingItemId);

    return {
      bookingId: booking.bookingId,
      bookingItemId: booking.bookingItemId,
      bookingItemName: bookingItem.data.productName,
      startDateTime: booking.startDateTime,
      duration: booking.duration,
      customerId: booking.customerId || '',
      staffId: staff.data._id,
      staffName: staff.data.name,
      status: booking.status,
      transactionId: booking.transactionId,
      notes: booking.notes,
      createdAt: booking.createdAt || new Date(),
      updatedAt: booking.updatedAt || new Date(),
      lastStatusChange: booking.statusUpdatedAt,
      lastStatusChangeReason: booking.statusUpdateReason
    };
  }

  private async findBookingById(bookingId: string): Promise<BookedObject | null> {
    const staffWithBookings = await this.staffUserService.findStaffWithBooking(bookingId);
    if (!staffWithBookings) {
      return null;
    }

    const booking = staffWithBookings.bookedObjects.find(b => b.bookingId === bookingId);
    if (!booking) {
      return null;
    }

    return {
      ...booking,
      staffId: staffWithBookings._id,
      staffName: staffWithBookings.name
    };
  }

  async getAssignedStaff(bookingId: string) {
    const booking = await this.findBookingById(bookingId);
    if (!booking) {
      return null;
    }

    const staff = await this.staffUserService.findById(booking.staffId);
    return staff?.data;
  }
}