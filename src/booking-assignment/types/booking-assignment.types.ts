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
  
  export interface BookingAssignmentResponse {
    data: BookedObject[];
  }
  
  export interface SingleBookingResponse {
    data: BookedObject | null;
  }