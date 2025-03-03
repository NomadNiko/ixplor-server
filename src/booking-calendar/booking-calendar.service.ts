import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingCalendarSchemaClass, BookingCalendarSchemaDocument, BookingStatusEnum } from './infrastructure/persistence/document/entities/booking-calendar.schema';
import { StaffRoleService } from '../staff-role/staff-role.service';
import { RoleShiftService } from '../role-shift/role-shift.service';
import { StaffScheduleService } from '../staff-schedule/staff-schedule.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { VendorService } from '../vendors/vendor.service';
import { ScheduleExceptionService } from '../schedule-exception/schedule-exception.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
 
interface TimeSlot {
  startTime: Date;
  endTime: Date;
  roleId: string;
  capacity: number;
  remainingCapacity: number;
}

@Injectable()
export class BookingCalendarService {
  constructor(
    @InjectModel(BookingCalendarSchemaClass.name)
    private readonly bookingCalendarModel: Model<BookingCalendarSchemaDocument>,
    private readonly staffRoleService: StaffRoleService,
    private readonly roleShiftService: RoleShiftService,
    private readonly staffScheduleService: StaffScheduleService,
    private readonly bookingItemService: BookingItemService,
    private readonly vendorService: VendorService,
    private readonly scheduleExceptionService: ScheduleExceptionService
  ) {}

  async create(createBookingDto: CreateBookingDto) {
    const session = await this.bookingCalendarModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        // 1. Validate the booking item exists
        const bookingItem = await this.bookingItemService.findById(createBookingDto.bookingItemId);
        if (!bookingItem) {
          throw new NotFoundException('Booking item not found');
        }

        // 2. Make sure the vendor matches the booking item
        if (createBookingDto.vendorId !== bookingItem.data.vendorId) {
          throw new BadRequestException('Vendor ID does not match booking item vendor');
        }

        // 3. Find a suitable role that can handle this booking
        const bookingDate = new Date(createBookingDto.startDateTime);
        const dayOfWeek = bookingDate.getDay();
        const timeString = this.formatTimeFromDate(bookingDate);
        
        // Find qualified roles with shifts at this time
        const qualifiedRolesResponse = await this.staffRoleService.findByBookingItem(createBookingDto.bookingItemId);
        const qualifiedRoleIds = qualifiedRolesResponse.data.map(role => role._id.toString());
        
        if (qualifiedRoleIds.length === 0) {
          throw new BadRequestException('No qualified roles found for this booking item');
        }

        // 4. Check for schedule exceptions
        const exceptions = await this.scheduleExceptionService.findForDate(
          createBookingDto.vendorId, 
          bookingDate
        );
        
        if (exceptions.data.length > 0) {
          const blockingException = exceptions.data.find(exception => 
            exception.affectedBookingItemIds.includes(createBookingDto.bookingItemId) ||
            exception.affectedRoleIds.some(roleId => qualifiedRoleIds.includes(roleId))
          );
          
          if (blockingException) {
            throw new BadRequestException(`Booking not available due to: ${blockingException.description}`);
          }
        }

        // 5. Find appropriate role shifts
        const availableShifts = await this.roleShiftService.findByDayAndTime(dayOfWeek, timeString);
        
        const qualifiedShifts = availableShifts.data.filter(shift => 
          qualifiedRoleIds.includes(shift.roleId) && 
          (shift.applicableBookingItems.length === 0 || 
           shift.applicableBookingItems.includes(createBookingDto.bookingItemId))
        );
        
        if (qualifiedShifts.length === 0) {
          throw new BadRequestException('No available role shifts found for this booking time');
        }

        // 6. Calculate booking end time
        const startDateTime = new Date(createBookingDto.startDateTime);
        const endDateTime = new Date(startDateTime.getTime() + createBookingDto.duration * 60000);
        
        // 7. Choose the most appropriate role shift (one with least bookings for now)
        let selectedRoleShift: typeof qualifiedShifts[0] | undefined = undefined;
        let lowestBookingCount = Infinity;
        
        for (const shift of qualifiedShifts) {
          // Check if the booking end time is within the shift
          const shiftEndHour = parseInt(shift.endTime.split(':')[0]);
          const shiftEndMinute = parseInt(shift.endTime.split(':')[1]);
          
          const shiftEndTime = new Date(startDateTime);
          shiftEndTime.setHours(shiftEndHour, shiftEndMinute, 0, 0);
          
          if (endDateTime > shiftEndTime) {
            continue; // This shift ends before the booking would complete
          }
          
          // Count existing bookings for this role and time period
          const existingBookings = await this.bookingCalendarModel.countDocuments({
            roleId: shift.roleId,
            startDateTime: {
              $lt: endDateTime,
              $gte: startDateTime
            },
            status: {
              $nin: [BookingStatusEnum.CANCELLED]
            }
          }).session(session);
          
          if (existingBookings < shift.capacity && existingBookings < lowestBookingCount) {
            selectedRoleShift = shift;
            lowestBookingCount = existingBookings;
          }
        }
        
        if (!selectedRoleShift) {
          throw new BadRequestException('All qualified roles are at capacity for this time slot');
        }

        // 8. Check if staff is already assigned to this role at this time
        let assignedStaffId: string | undefined = undefined;
        
        if (createBookingDto.staffId) {
          // If staff ID was provided, verify they're qualified for this role
          const staffUser = await this.staffScheduleService.findStaffAssignmentForRole(
            selectedRoleShift.roleId,
            startDateTime
          );
          
          if (staffUser && staffUser.staffId === createBookingDto.staffId) {
            assignedStaffId = createBookingDto.staffId;
          } else {
            // Staff is not assigned to this role at this time
            throw new BadRequestException('Specified staff is not assigned to this role at the requested time');
          }
        } else {
          // Try to find staff assigned to this role at this time
          const staffUser = await this.staffScheduleService.findStaffAssignmentForRole(
            selectedRoleShift.roleId,
            startDateTime
          );
          
          if (staffUser) {
            assignedStaffId = staffUser.staffId;
          }
          // If no staff is assigned yet, the booking will still be created with null staffId
        }

        // 9. Create the booking
        const newBooking = new this.bookingCalendarModel({
          ...createBookingDto,
          roleId: selectedRoleShift.roleId,
          staffId: assignedStaffId,
          status: BookingStatusEnum.PENDING
        });
        
        const savedBooking = await newBooking.save({ session });
        
        result = {
          data: savedBooking,
          message: 'Booking created successfully'
        };
      });
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException || 
          error instanceof ConflictException) {
        throw error;
      }
      console.error('Error creating booking:', error);
      throw new InternalServerErrorException('Failed to create booking');
    } finally {
      await session.endSession();
    }
  }

  async findById(id: string) {
    try {
      const booking = await this.bookingCalendarModel.findById(id).exec();
      
      if (!booking) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }
      
      return {
        data: booking,
        message: 'Booking found'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding booking ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch booking');
    }
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const session = await this.bookingCalendarModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        const booking = await this.bookingCalendarModel.findById(id).session(session);
        
        if (!booking) {
          throw new NotFoundException(`Booking with ID ${id} not found`);
        }
        
        // If status is being updated to CANCELLED, we don't need to check availabilities
        if (updateBookingDto.status === BookingStatusEnum.CANCELLED) {
          Object.assign(booking, updateBookingDto);
          booking.statusUpdatedAt = new Date();
          const updatedBooking = await booking.save({ session });
          
          result = {
            data: updatedBooking,
            message: 'Booking cancelled successfully'
          };
          return;
        }
        
        // If changing date/time or role, we need to validate availability
        if (updateBookingDto.startDateTime || updateBookingDto.roleId) {
          const startDateTime = updateBookingDto.startDateTime 
            ? new Date(updateBookingDto.startDateTime) 
            : booking.startDateTime;
          
          const roleId = updateBookingDto.roleId || booking.roleId;
          const duration = updateBookingDto.duration || booking.duration;
          
          // Calculate booking end time
          const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
          
          // If role is changing, check if new role is qualified for this booking item
          if (updateBookingDto.roleId && updateBookingDto.roleId !== booking.roleId) {
            const role = await this.staffRoleService.findById(updateBookingDto.roleId);
            
            if (!role.data.qualifiedBookingItems.includes(booking.bookingItemId)) {
              throw new BadRequestException('The selected role is not qualified for this booking item');
            }
          }
          
          // Check for conflicts with existing bookings for the same role
          const conflictingBookings = await this.bookingCalendarModel.find({
            _id: { $ne: id },
            roleId,
            startDateTime: {
              $lt: endDateTime
            },
            $expr: {
              $gt: [
                { $add: ['$startDateTime', { $multiply: ['$duration', 60000] }] },
                startDateTime.getTime()
              ]
            },
            status: {
              $nin: [BookingStatusEnum.CANCELLED]
            }
          }).session(session);
          
          const role = await this.staffRoleService.findById(roleId);
          const capacity = role.data.defaultCapacity;
          
          if (conflictingBookings.length >= capacity) {
            throw new BadRequestException('The role is already at capacity for this time slot');
          }
        }
        
        // Update staff assignment if needed
        if (updateBookingDto.staffId) {
          const startDateTime = updateBookingDto.startDateTime 
            ? new Date(updateBookingDto.startDateTime) 
            : booking.startDateTime;
            
          const roleId = updateBookingDto.roleId || booking.roleId;
          
          // Verify staff is assigned to this role at this time
          const staffAssignment = await this.staffScheduleService.findStaffAssignmentForRole(
            roleId,
            startDateTime
          );
          
          if (!staffAssignment || staffAssignment.staffId !== updateBookingDto.staffId) {
            throw new BadRequestException('Specified staff is not assigned to this role at the requested time');
          }
        }
        
        // Apply updates
        Object.assign(booking, updateBookingDto);
        
        if (updateBookingDto.status) {
          booking.statusUpdatedAt = new Date();
        }
        
        const updatedBooking = await booking.save({ session });
        
        result = {
          data: updatedBooking,
          message: 'Booking updated successfully'
        };
      });
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException || 
          error instanceof ConflictException) {
        throw error;
      }
      console.error(`Error updating booking ${id}:`, error);
      throw new InternalServerErrorException('Failed to update booking');
    } finally {
      await session.endSession();
    }
  }

  async delete(id: string) {
    try {
      const booking = await this.bookingCalendarModel.findByIdAndDelete(id);
      
      if (!booking) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }
      
      return {
        message: 'Booking deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error deleting booking ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete booking');
    }
  }

  async updateStatus(id: string, status: BookingStatusEnum, statusUpdateReason?: string) {
    try {
      const booking = await this.bookingCalendarModel.findById(id);
      
      if (!booking) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }
      
      booking.status = status;
      booking.statusUpdateReason = statusUpdateReason as string;
      booking.statusUpdatedAt = new Date();
      
      const updatedBooking = await booking.save();
      
      return {
        data: updatedBooking,
        message: 'Booking status updated successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error updating booking status for ${id}:`, error);
      throw new InternalServerErrorException('Failed to update booking status');
    }
  }

  async findByVendor(vendorId: string, date?: Date, status?: string) {
    try {
      const query: any = { vendorId };
      
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query.startDateTime = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      }
      
      if (status) {
        query.status = status;
      }
      
      const bookings = await this.bookingCalendarModel
        .find(query)
        .sort({ startDateTime: 1 })
        .exec();
      
      return {
        data: bookings,
        message: `Found ${bookings.length} bookings`
      };
    } catch (error) {
      console.error(`Error finding bookings for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to fetch vendor bookings');
    }
  }

  async findByRole(roleId: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { roleId };
      
      if (startDate || endDate) {
        query.startDateTime = {};
        
        if (startDate) {
          query.startDateTime.$gte = startDate;
        }
        
        if (endDate) {
          query.startDateTime.$lte = endDate;
        }
      }
      
      const bookings = await this.bookingCalendarModel
        .find(query)
        .sort({ startDateTime: 1 })
        .exec();
      
      return {
        data: bookings,
        message: `Found ${bookings.length} bookings`
      };
    } catch (error) {
      console.error(`Error finding bookings for role ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to fetch role bookings');
    }
  }

  async findByStaff(staffId: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { staffId };
      
      if (startDate || endDate) {
        query.startDateTime = {};
        
        if (startDate) {
          query.startDateTime.$gte = startDate;
        }
        
        if (endDate) {
          query.startDateTime.$lte = endDate;
        }
      }
      
      const bookings = await this.bookingCalendarModel
        .find(query)
        .sort({ startDateTime: 1 })
        .exec();
      
      return {
        data: bookings,
        message: `Found ${bookings.length} bookings`
      };
    } catch (error) {
      console.error(`Error finding bookings for staff ${staffId}:`, error);
      throw new InternalServerErrorException('Failed to fetch staff bookings');
    }
  }

  async findByCustomer(customerId: string) {
    try {
      const bookings = await this.bookingCalendarModel
        .find({ customerId })
        .sort({ startDateTime: 1 })
        .exec();
      
      return {
        data: bookings,
        message: `Found ${bookings.length} bookings`
      };
    } catch (error) {
      console.error(`Error finding bookings for customer ${customerId}:`, error);
      throw new InternalServerErrorException('Failed to fetch customer bookings');
    }
  }

  async assignStaff(bookingId: string, staffId: string) {
    const session = await this.bookingCalendarModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        const booking = await this.bookingCalendarModel.findById(bookingId).session(session);
        
        if (!booking) {
          throw new NotFoundException(`Booking with ID ${bookingId} not found`);
        }
        
        // Verify staff is assigned to this role at this time
        const staffAssignment = await this.staffScheduleService.findStaffAssignmentForRole(
          booking.roleId,
          booking.startDateTime
        );
        
        if (!staffAssignment || staffAssignment.staffId !== staffId) {
          throw new BadRequestException('Staff is not assigned to this role at the booking time');
        }
        
        booking.staffId = staffId;
        booking.updatedAt = new Date();
        
        const updatedBooking = await booking.save({ session });
        
        result = {
          data: updatedBooking,
          message: 'Staff assigned to booking successfully'
        };
      });
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(`Error assigning staff to booking ${bookingId}:`, error);
      throw new InternalServerErrorException('Failed to assign staff to booking');
    } finally {
      await session.endSession();
    }
  }

  async checkRoleAvailability(roleId: string, date: Date, duration: number) {
    try {
      const role = await this.staffRoleService.findById(roleId);
      const dayOfWeek = date.getDay();
      const timeString = this.formatTimeFromDate(date);
      
      // Get role shifts for this day and time
      const availableShifts = await this.roleShiftService.findByDayAndTime(dayOfWeek, timeString);
      
      const roleShift = availableShifts.data.find(shift => shift.roleId === roleId);
      
      if (!roleShift) {
        return {
          available: false,
          reason: 'No shifts defined for this role at the requested time'
        };
      }
      
      // Check if booking end is within shift
      const endDateTime = new Date(date.getTime() + duration * 60000);
      const shiftEndHour = parseInt(roleShift.endTime.split(':')[0]);
      const shiftEndMinute = parseInt(roleShift.endTime.split(':')[1]);
      
      const shiftEndTime = new Date(date);
      shiftEndTime.setHours(shiftEndHour, shiftEndMinute, 0, 0);
      
      if (endDateTime > shiftEndTime) {
        return {
          available: false,
          reason: 'Requested time extends beyond the shift end time'
        };
      }
      
      // Check capacity
      const existingBookings = await this.bookingCalendarModel.countDocuments({
        roleId,
        startDateTime: {
          $lt: endDateTime
        },
        $expr: {
          $gt: [
            { $add: ['$startDateTime', { $multiply: ['$duration', 60000] }] },
            date.getTime()
          ]
        },
        status: {
          $nin: [BookingStatusEnum.CANCELLED]
        }
      });
      
      const capacity = roleShift.capacity || (role.data ? role.data.defaultCapacity : 1);
      
      if (existingBookings >= capacity) {
        return {
          available: false,
          reason: 'Role is at capacity for this time slot'
        };
      }
      
      return {
        available: true,
        capacity,
        remainingCapacity: capacity - existingBookings
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          available: false,
          reason: 'Role not found'
        };
      }
      console.error(`Error checking role availability for ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to check role availability');
    }
  }

  async findAvailabilityForBookingItem(bookingItemId: string, date: Date) {
    try {
      // 1. Find qualified roles for this booking item
      const qualifiedRolesResponse = await this.staffRoleService.findByBookingItem(bookingItemId);
      const qualifiedRoleIds = qualifiedRolesResponse.data.map(role => role._id.toString());
      
      if (qualifiedRoleIds.length === 0) {
        return {
          available: false,
          reason: 'No qualified roles found for this booking item',
          availableTimeSlots: [] as TimeSlot[]
        };
      }
      
      // 2. Get day of week
      const dayOfWeek = date.getDay();
      
      // 3. Find all shifts for qualified roles on this day
      const availableShiftsResponses = await Promise.all(
        qualifiedRoleIds.map(roleId => 
          this.roleShiftService.findByRole(roleId)
        )
      );
      
      const allShifts = availableShiftsResponses.flatMap(response => response.data);
      const dayShifts = allShifts.filter(shift => 
        shift.dayOfWeek === dayOfWeek &&
        shift.isActive &&
        (shift.applicableBookingItems.length === 0 || 
         shift.applicableBookingItems.includes(bookingItemId))
      );
      
      if (dayShifts.length === 0) {
        return {
          available: false,
          reason: 'No shifts available for this booking item on the requested day',
          availableTimeSlots: [] as TimeSlot[]
        };
      }
      
      // 4. Check for schedule exceptions
      const exceptions = await this.scheduleExceptionService.findForDate(
        null, // We don't have vendorId at this point, so we'll filter later
        date
      );
      
      // 5. Get the booking item details for duration
      const bookingItem = await this.bookingItemService.findById(bookingItemId);
      
      if (!bookingItem) {
        throw new NotFoundException('Booking item not found');
      }
      
      const duration = bookingItem.data.duration;
      
      // 6. Generate time slots for each shift
      const availableTimeSlots: TimeSlot[] = [];
      
      for (const shift of dayShifts) {
        // Check if any exceptions apply to this shift
        const blockingException = exceptions.data.find(exception => 
          (exception.affectedBookingItemIds.includes(bookingItemId) ||
           exception.affectedRoleIds.includes(shift.roleId))
        );
        
        if (blockingException) {
          continue; // Skip this shift due to exception
        }
        
        // Generate time slots at 30-minute intervals
        const shiftStartHour = parseInt(shift.startTime.split(':')[0]);
        const shiftStartMinute = parseInt(shift.startTime.split(':')[1]);
        
        const shiftEndHour = parseInt(shift.endTime.split(':')[0]);
        const shiftEndMinute = parseInt(shift.endTime.split(':')[1]);
        
        const startDate = new Date(date);
        startDate.setHours(shiftStartHour, shiftStartMinute, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(shiftEndHour, shiftEndMinute, 0, 0);
        
        // Duration in milliseconds
        const durationMs = duration * 60000;
        
        // Generate slots at 30-minute intervals
        for (let time = startDate.getTime(); time <= endDate.getTime() - durationMs; time += 30 * 60000) {
          const timeSlot = new Date(time);
          
          // Check if this time slot is available based on capacity
          const roleAvailability = await this.checkRoleAvailability(
            shift.roleId, 
            timeSlot,
            duration
          );
          
          if (roleAvailability.available) {
            availableTimeSlots.push({
              startTime: timeSlot,
              endTime: new Date(timeSlot.getTime() + durationMs),
              roleId: shift.roleId,
              capacity: roleAvailability.capacity || 0,
              remainingCapacity: roleAvailability.remainingCapacity || 0
            });
          }
        }
      }
      
      // Sort time slots chronologically
      availableTimeSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      return {
        available: availableTimeSlots.length > 0,
        reason: availableTimeSlots.length > 0 ? null : 'No available time slots found',
        availableTimeSlots
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding availability for booking item ${bookingItemId}:`, error);
      throw new InternalServerErrorException('Failed to find booking item availability');
    }
  }

  private formatTimeFromDate(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}