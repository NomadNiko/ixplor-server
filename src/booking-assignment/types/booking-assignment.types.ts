export interface BookedObject {
    bookingId: string;
    startDateTime: Date;
    duration: number;
    staffId: string;
    bookingItemId: string;
    status: string;
    staffName?: string;
    customerId?: string;
    transactionId?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
    statusUpdatedAt?: Date;
    statusUpdateReason?: string;
  }

  export interface BookingDetailsDto {
    bookingId: string;
    bookingItemId: string;
    bookingItemName: string;
    startDateTime: Date;
    duration: number;
    customerId: string;
    staffId: string;
    staffName: string;
    status: string;
    transactionId?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    lastStatusChange?: Date;
    lastStatusChangeReason?: string;
    price?: number;         // Add price field
    vendorId?: string;      // Add vendorId field
  }


  export interface AvailableStaffDto {
  staffId: string;
  name: string;
  availableTimeSlots: Array<{
    startTime: Date;
    endTime: Date;
  }>;
  qualifiedForBookingItem: boolean;
  currentWorkload: number;
  maxDailyBookings: number;
  qualifications?: string[];
  specialties?: string;
  bookingSuccessRate?: number;
  _id: string;                // Add _id field
  bookedObjects?: any[];      // Add bookedObjects field to match implementation
}
  
  export interface BookingAssignmentResponse {
    data: BookedObject[];
  }
  
  export interface SingleBookingResponse {
    data: BookedObject | null;
  }