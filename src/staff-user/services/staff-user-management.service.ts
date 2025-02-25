import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StaffUserSchemaClass,
  StaffUserSchemaDocument,
  StaffUserStatusEnum,
  BookedObject,
} from '../infrastructure/persistence/document/entities/staff-user.schema';
import { StaffUserTransformService } from './staff-user-transform.service';
import {
  CreateStaffUserDto,
  UpdateStaffUserDto,
  AddShiftDto,
  AddQualificationDto,
} from '../types/staff-user.interfaces';

@Injectable()
export class StaffUserManagementService {
  constructor(
    @InjectModel(StaffUserSchemaClass.name)
    private readonly staffUserModel: Model<StaffUserSchemaDocument>,
    private readonly transformService: StaffUserTransformService,
  ) {}

  async create(createStaffUserDto: CreateStaffUserDto) {
    try {
      // Create with empty arrays and defaults
      const createdStaffUser = new this.staffUserModel({
        name: createStaffUserDto.name,
        vendorId: createStaffUserDto.vendorId,
        email: createStaffUserDto.email,
        phone: createStaffUserDto.phone,
        status: createStaffUserDto.status || StaffUserStatusEnum.ACTIVE,
        qualifiedProducts: [], // Initialize empty
        shifts: [], // Initialize empty
        bookedObjects: [], // Initialize empty
      });

      const staffUser = await createdStaffUser.save();

      return {
        data: this.transformService.transformStaffUserResponse(staffUser),
        message: 'Staff user created successfully',
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async update(id: string, updateStaffUserDto: UpdateStaffUserDto) {
    try {
      const staffUser = await this.staffUserModel.findById(id);

      if (!staffUser) {
        throw new NotFoundException(`Staff user with ID ${id} not found`);
      }

      // Update basic fields, preserving bookedObjects
      Object.keys(updateStaffUserDto).forEach((key) => {
        if (key !== 'shifts' && key !== 'bookedObjects') {
          staffUser[key] = updateStaffUserDto[key];
        }
      });

      // Handle shifts update if provided, ensuring _id fields
      if (updateStaffUserDto.shifts) {
        staffUser.shifts = updateStaffUserDto.shifts.map((shift) => ({
          ...shift,
          _id: shift._id
            ? new Types.ObjectId(shift._id.toString())
            : new Types.ObjectId(),
        }));
      }

      const updatedStaffUser = await staffUser.save();

      return {
        data: this.transformService.transformStaffUserResponse(
          updatedStaffUser,
        ),
        message: 'Staff user updated successfully',
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async removeBookingFromStaff(staffId: string, bookingId: string): Promise<void> {
    const staff = await this.staffUserModel.findById(staffId);
    
    if (!staff) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }
    
    const initialLength = staff.bookedObjects.length;
    staff.bookedObjects = staff.bookedObjects.filter(
      booking => booking.bookingId !== bookingId
    );
    
    if (staff.bookedObjects.length === initialLength) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }
    
    staff.updatedAt = new Date();
    await staff.save();
  }

  async updateStatus(id: string, status: StaffUserStatusEnum) {
    const staffUser = await this.staffUserModel.findById(id);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    staffUser.status = status;
    staffUser.updatedAt = new Date();

    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Staff user status updated successfully',
    };
  }

  async remove(id: string) {
    const staffUser = await this.staffUserModel.findById(id);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    // Check if staff has any active bookings
    const hasActiveBookings = staffUser.bookedObjects.some(
      (booking) =>
        booking.status === 'PENDING' || booking.status === 'CONFIRMED',
    );

    if (hasActiveBookings) {
      throw new BadRequestException(
        'Cannot delete staff user with active bookings',
      );
    }

    await this.staffUserModel.findByIdAndDelete(id);

    return {
      message: 'Staff user deleted successfully',
    };
  }

  async addShift(id: string, shiftData: AddShiftDto) {
    const staffUser = await this.staffUserModel.findById(id);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    if (shiftData.startDateTime >= shiftData.endDateTime) {
      throw new BadRequestException('Shift end time must be after start time');
    }

    // Validate that the new shift doesn't overlap with existing shifts
    const hasOverlap = staffUser.shifts.some(
      (shift) =>
        shiftData.startDateTime < shift.endDateTime &&
        shiftData.endDateTime > shift.startDateTime,
    );

    if (hasOverlap) {
      throw new ConflictException('New shift overlaps with existing shifts');
    }

    // Convert AddShiftDto to ShiftObject by adding the missing _id
    const newShift = {
      ...shiftData,
      _id: new Types.ObjectId(),
    };

    staffUser.shifts.push(newShift);
    staffUser.updatedAt = new Date();

    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Shift added successfully',
    };
  }

  async removeShift(staffId: string, shiftId: string) {
    const staffUser = await this.staffUserModel.findById(staffId);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }

    const initialLength = staffUser.shifts.length;
    staffUser.shifts = staffUser.shifts.filter(
      (shift) => shift._id.toString() !== shiftId,
    );

    if (staffUser.shifts.length === initialLength) {
      throw new NotFoundException(`Shift with ID ${shiftId} not found`);
    }

    staffUser.updatedAt = new Date();
    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Shift removed successfully',
    };
  }

  async addQualification(id: string, qualificationData: AddQualificationDto) {
    const staffUser = await this.staffUserModel.findById(id);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${id} not found`);
    }

    if (staffUser.qualifiedProducts.includes(qualificationData.bookingItemId)) {
      throw new ConflictException(
        'Staff user is already qualified for this booking item',
      );
    }

    staffUser.qualifiedProducts.push(qualificationData.bookingItemId);
    staffUser.updatedAt = new Date();

    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Qualification added successfully',
    };
  }

  async removeQualification(staffId: string, bookingItemId: string) {
    const staffUser = await this.staffUserModel.findById(staffId);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }

    if (!staffUser.qualifiedProducts.includes(bookingItemId)) {
      throw new NotFoundException(
        `Staff user is not qualified for booking item ${bookingItemId}`,
      );
    }

    staffUser.qualifiedProducts = staffUser.qualifiedProducts.filter(
      (id) => id !== bookingItemId,
    );
    staffUser.updatedAt = new Date();

    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Qualification removed successfully',
    };
  }

  async addBooking(staffId: string, bookingData: Omit<BookedObject, '_id'>) {
    const staffUser = await this.staffUserModel.findById(staffId);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }

    // Check if staff is qualified for this booking
    if (!staffUser.qualifiedProducts.includes(bookingData.bookingItemId)) {
      throw new BadRequestException(
        'Staff is not qualified for this booking item',
      );
    }

    const bookingEndTime = new Date(
      bookingData.startDateTime.getTime() + bookingData.duration * 60000,
    );

    // Check if staff has a shift that covers the booking time
    const hasShift = staffUser.shifts.some(
      (shift) =>
        shift.startDateTime <= bookingData.startDateTime &&
        shift.endDateTime >= bookingEndTime,
    );

    if (!hasShift) {
      throw new BadRequestException(
        'No staff shift available for this booking time',
      );
    }

    // Check for booking conflicts
    const hasConflict = staffUser.bookedObjects.some((booking) => {
      if (booking.status === 'CANCELLED') return false;

      const bookingStart = new Date(booking.startDateTime);
      const bookingEnd = new Date(
        booking.startDateTime.getTime() + booking.duration * 60000,
      );

      return (
        bookingData.startDateTime < bookingEnd && bookingEndTime > bookingStart
      );
    });

    if (hasConflict) {
      throw new ConflictException('Booking conflicts with existing bookings');
    }

    const newBooking = {
      ...bookingData,
      _id: new Types.ObjectId(),
    };

    // Explicitly add the new booking and save
    staffUser.bookedObjects.push(newBooking);
    staffUser.updatedAt = new Date();

    // Await the save operation
    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Booking added successfully',
    };
  }

  async updateBookingStatus(
    staffId: string,
    bookingId: string,
    status: string,
  ) {
    const staffUser = await this.staffUserModel.findById(staffId);

    if (!staffUser) {
      throw new NotFoundException(`Staff user with ID ${staffId} not found`);
    }

    const booking = staffUser.bookedObjects.find(
      (b) => b._id && b._id.toString() === bookingId,
    );

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    booking.status = status;
    staffUser.updatedAt = new Date();

    const updatedStaffUser = await staffUser.save();

    return {
      data: this.transformService.transformStaffUserResponse(updatedStaffUser),
      message: 'Booking status updated successfully',
    };
  }

  async findBestAvailableStaff(
    bookingItemId: string,
    startDateTime: Date,
    duration: number,
  ) {
    // Find all qualified and available staff
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const qualifiedStaff = await this.staffUserModel
      .find({
        qualifiedProducts: bookingItemId,
        status: StaffUserStatusEnum.ACTIVE,
        shifts: {
          $elemMatch: {
            startDateTime: { $lte: startDateTime },
            endDateTime: { $gte: endDateTime },
          },
        },
      })
      .exec();

    if (qualifiedStaff.length === 0) {
      return null;
    }

    // Filter out staff with booking conflicts
    const availableStaff = qualifiedStaff.filter((staff) => {
      const hasConflict = staff.bookedObjects.some((booking) => {
        if (booking.status === 'CANCELLED') return false;

        const bookingStart = new Date(booking.startDateTime);
        const bookingEnd = new Date(
          booking.startDateTime.getTime() + booking.duration * 60000,
        );

        return startDateTime < bookingEnd && endDateTime > bookingStart;
      });

      return !hasConflict;
    });

    if (availableStaff.length === 0) {
      return null;
    }

    // Sort by current workload (less busy staff first)
    availableStaff.sort((a, b) => {
      const aWorkload = a.bookedObjects.filter(
        (b) => b.status !== 'CANCELLED' && b.status !== 'COMPLETED',
      ).length;

      const bWorkload = b.bookedObjects.filter(
        (b) => b.status !== 'CANCELLED' && b.status !== 'COMPLETED',
      ).length;

      return aWorkload - bWorkload;
    });

    return this.transformService.transformStaffUserResponse(availableStaff[0]);
  }

  async reassignBooking(
    bookingId: string,
    fromStaffId: string,
    toStaffId: string,
  ) {
    const session = await this.staffUserModel.db.startSession();
    session.startTransaction();

    try {
      // Get both staff members
      const fromStaff = await this.staffUserModel
        .findById(fromStaffId)
        .session(session);
      const toStaff = await this.staffUserModel
        .findById(toStaffId)
        .session(session);

      if (!fromStaff) {
        throw new NotFoundException(
          `Source staff with ID ${fromStaffId} not found`,
        );
      }

      if (!toStaff) {
        throw new NotFoundException(
          `Target staff with ID ${toStaffId} not found`,
        );
      }

      // Find the booking
      const bookingIndex = fromStaff.bookedObjects.findIndex(
        (b) => b._id && b._id.toString() === bookingId,
      );

      if (bookingIndex === -1) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      const booking = fromStaff.bookedObjects[bookingIndex];

      // Check if target staff is qualified
      if (!toStaff.qualifiedProducts.includes(booking.bookingItemId)) {
        throw new BadRequestException(
          'Target staff is not qualified for this booking',
        );
      }

      // Check for scheduling conflicts
      const bookingEndTime = new Date(
        booking.startDateTime.getTime() + booking.duration * 60000,
      );

      // Check if staff has a shift that covers the booking time
      const hasShift = toStaff.shifts.some(
        (shift) =>
          shift.startDateTime <= booking.startDateTime &&
          shift.endDateTime >= bookingEndTime,
      );

      if (!hasShift) {
        throw new BadRequestException(
          'Target staff has no shift available for this booking time',
        );
      }

      // Check for booking conflicts
      const hasConflict = toStaff.bookedObjects.some((existingBooking) => {
        if (existingBooking.status === 'CANCELLED') return false;

        const bookingStart = new Date(existingBooking.startDateTime);
        const bookingEnd = new Date(
          bookingStart.getTime() + existingBooking.duration * 60000,
        );

        return (
          booking.startDateTime < bookingEnd && bookingEndTime > bookingStart
        );
      });

      if (hasConflict) {
        throw new ConflictException(
          "Booking conflicts with target staff's existing bookings",
        );
      }

      // Move the booking
      toStaff.bookedObjects.push(booking);
      fromStaff.bookedObjects.splice(bookingIndex, 1);

      // Update timestamps
      fromStaff.updatedAt = new Date();
      toStaff.updatedAt = new Date();

      // Save both staff members
      await fromStaff.save({ session });
      await toStaff.save({ session });

      await session.commitTransaction();

      return {
        data: this.transformService.transformStaffUserResponse(toStaff),
        message: 'Booking reassigned successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Await the session.endSession() promise
      await session.endSession();
    }
  }
}
