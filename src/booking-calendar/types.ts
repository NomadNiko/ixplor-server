export interface TimeSlot {
    startTime: Date;
    endTime: Date;
    roleId: string;
    capacity: number;
    remainingCapacity: number;
  }
  
  export interface BookingItemAvailabilityResponse {
    available: boolean;
    reason: string | null;
    availableTimeSlots: TimeSlot[];
  }