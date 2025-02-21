import { Injectable } from '@nestjs/common';
import { StaffUserResponse } from '../types/staff-user.interfaces';

@Injectable()
export class StaffUserTransformService {
  transformStaffUserResponse(staffUser: Record<string, any>): StaffUserResponse {
    return {
      _id: staffUser._id.toString(),
      name: staffUser.name,
      vendorId: staffUser.vendorId,
      qualifiedProducts: [...staffUser.qualifiedProducts],
      shifts: staffUser.shifts.map(shift => ({
        startDateTime: shift.startDateTime instanceof Date 
          ? shift.startDateTime 
          : new Date(shift.startDateTime),
        endDateTime: shift.endDateTime instanceof Date 
          ? shift.endDateTime 
          : new Date(shift.endDateTime)
      })),
      bookedObjects: staffUser.bookedObjects.map(booking => ({
        bookingItemId: booking.bookingItemId,
        startDateTime: booking.startDateTime instanceof Date 
          ? booking.startDateTime 
          : new Date(booking.startDateTime),
        duration: booking.duration,
        transactionId: booking.transactionId,
        customerId: booking.customerId,
        status: booking.status
      })),
      status: staffUser.status,
      email: staffUser.email,
      phone: staffUser.phone,
      notes: staffUser.notes,
      currentWorkload: typeof staffUser.currentWorkload === 'function' 
        ? staffUser.currentWorkload() 
        : staffUser.currentWorkload,
      dailyWorkload: typeof staffUser.dailyWorkload === 'function' 
        ? staffUser.dailyWorkload() 
        : staffUser.dailyWorkload,
      qualificationCount: typeof staffUser.qualificationCount === 'function' 
        ? staffUser.qualificationCount() 
        : staffUser.qualificationCount,
      createdAt: staffUser.createdAt?.toISOString(),
      updatedAt: staffUser.updatedAt?.toISOString()
    };
  }
}