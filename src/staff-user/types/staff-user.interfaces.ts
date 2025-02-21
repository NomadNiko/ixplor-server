import { StaffUserStatusEnum } from '../infrastructure/persistence/document/entities/staff-user.schema';
import { Types } from 'mongoose';

export interface ShiftObjectBase {
  _id?: Types.ObjectId | string;
  startDateTime: Date;
  endDateTime: Date;
}

export interface BookedObjectBase {
  _id?: Types.ObjectId | string;
  bookingItemId: string;
  startDateTime: Date;
  duration: number;
  transactionId?: string;
  customerId?: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export interface StaffUserBase {
  name: string;
  vendorId: string;
  qualifiedProducts: string[];
  shifts: ShiftObjectBase[];
  bookedObjects: BookedObjectBase[];
  status: StaffUserStatusEnum;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface StaffUserResponse extends StaffUserBase {
  _id: string;
  currentWorkload?: number;
  dailyWorkload?: number;
  qualificationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffUserDto extends Omit<StaffUserBase, 'shifts' | 'bookedObjects'> {
  shifts?: ShiftObjectBase[];
  bookedObjects?: never;
}

export interface UpdateStaffUserDto extends Partial<CreateStaffUserDto> {
  status?: StaffUserStatusEnum;
}

export interface AddShiftDto {
  startDateTime: Date;
  endDateTime: Date;
}

export interface AddQualificationDto {
  bookingItemId: string;
}

export interface StaffWorkloadDto {
  staffId: string;
  date: Date;
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  utilizationRate: number;
  timeSlots: Array<{
    hour: number;
    isBooked: boolean;
    bookingId?: string;
  }>;
}

export interface StaffAvailabilityDto {
  staffId: string;
  name: string;
  availableTimeSlots: Array<{
    startTime: Date;
    endTime: Date;
  }>;
  qualifiedForBookingItem: boolean;
  currentWorkload: number;
}

export interface ServiceResponse<T> {
  data: T;
  message?: string;
}

export interface QueryResponse<T> {
  data: T[];
}