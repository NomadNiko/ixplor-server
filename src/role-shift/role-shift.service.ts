import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoleShiftSchemaClass, RoleShiftSchemaDocument } from './infrastructure/persistence/document/entities/role-shift.schema';
import { CreateRoleShiftDto } from './dto/create-role-shift.dto';
import { UpdateRoleShiftDto } from './dto/update-role-shift.dto';
import { StaffRoleService } from '../staff-role/staff-role.service';
import { BookingItemService } from '../booking-item/booking-item.service';

@Injectable()
export class RoleShiftService {
  constructor(
    @InjectModel(RoleShiftSchemaClass.name)
    private readonly roleShiftModel: Model<RoleShiftSchemaDocument>,
    private readonly staffRoleService: StaffRoleService,
    private readonly bookingItemService: BookingItemService,
  ) {}

  async create(createRoleShiftDto: CreateRoleShiftDto) {
    try {
      const roleResponse = await this.staffRoleService.findById(createRoleShiftDto.roleId);
      const role = roleResponse.data;
      
      this.validateTimeFormat(createRoleShiftDto.startTime);
      this.validateTimeFormat(createRoleShiftDto.endTime);
      
      if (createRoleShiftDto.startTime >= createRoleShiftDto.endTime) {
        throw new BadRequestException('End time must be after start time');
      }
      
      if (createRoleShiftDto.applicableBookingItems?.length) {
        for (const bookingItemId of createRoleShiftDto.applicableBookingItems) {
          if (!role.qualifiedBookingItems.includes(bookingItemId)) {
            throw new BadRequestException(`Role is not qualified for booking item ${bookingItemId}`);
          }
        }
      }
      
      if (!createRoleShiftDto.capacity) {
        createRoleShiftDto.capacity = role.defaultCapacity;
      }
      
      createRoleShiftDto.vendorId = role.vendorId;
      
      const roleShift = new this.roleShiftModel(createRoleShiftDto);
      const savedShift = await roleShift.save();
      
      return {
        data: savedShift,
        message: 'Role shift created successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating role shift:', error);
      throw new InternalServerErrorException('Failed to create role shift');
    }
  }

  async findAll() {
    try {
      const shifts = await this.roleShiftModel.find().exec();
      return { data: shifts };
    } catch (error) {
      console.error('Error finding all role shifts:', error);
      throw new InternalServerErrorException('Failed to fetch role shifts');
    }
  }

  async findByVendor(vendorId: string) {
    try {
      const shifts = await this.roleShiftModel.find({ vendorId }).exec();
      return { data: shifts };
    } catch (error) {
      console.error(`Error finding role shifts for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to fetch vendor role shifts');
    }
  }

  async findByRole(roleId: string) {
    try {
      const shifts = await this.roleShiftModel.find({ roleId }).exec();
      return { data: shifts };
    } catch (error) {
      console.error(`Error finding shifts for role ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to fetch role shifts');
    }
  }

  async findById(id: string) {
    try {
      const shift = await this.roleShiftModel.findById(id).exec();
      if (!shift) {
        throw new NotFoundException(`Role shift with ID ${id} not found`);
      }
      return { data: shift };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding role shift ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch role shift');
    }
  }

  async update(id: string, updateRoleShiftDto: UpdateRoleShiftDto) {
    try {
      const shift = await this.roleShiftModel.findById(id).exec();
      if (!shift) {
        throw new NotFoundException(`Role shift with ID ${id} not found`);
      }
      if (updateRoleShiftDto.startTime) {
        this.validateTimeFormat(updateRoleShiftDto.startTime);
      }
      
      if (updateRoleShiftDto.endTime) {
        this.validateTimeFormat(updateRoleShiftDto.endTime);
      }
      
      if (updateRoleShiftDto.startTime && updateRoleShiftDto.endTime) {
        if (updateRoleShiftDto.startTime >= updateRoleShiftDto.endTime) {
          throw new BadRequestException('End time must be after start time');
        }
      } else if (updateRoleShiftDto.startTime && shift.endTime) {
        if (updateRoleShiftDto.startTime >= shift.endTime) {
          throw new BadRequestException('End time must be after start time');
        }
      } else if (shift.startTime && updateRoleShiftDto.endTime) {
        if (shift.startTime >= updateRoleShiftDto.endTime) {
          throw new BadRequestException('End time must be after start time');
        }
      }
      
      if (updateRoleShiftDto.applicableBookingItems?.length) {
        const roleResponse = await this.staffRoleService.findById(shift.roleId);
        const role = roleResponse.data;
        
        for (const bookingItemId of updateRoleShiftDto.applicableBookingItems) {
          if (!role.qualifiedBookingItems.includes(bookingItemId)) {
            throw new BadRequestException(`Role is not qualified for booking item ${bookingItemId}`);
          }
        }
      }
      const updatedShift = await this.roleShiftModel
        .findByIdAndUpdate(id, updateRoleShiftDto, { new: true })
        .exec();
      
      return {
        data: updatedShift,
        message: 'Role shift updated successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error updating role shift ${id}:`, error);
      throw new InternalServerErrorException('Failed to update role shift');
    }
  }

  async remove(id: string) {
    try {
      const deletedShift = await this.roleShiftModel.findByIdAndDelete(id).exec();
      if (!deletedShift) {
        throw new NotFoundException(`Role shift with ID ${id} not found`);
      }
      return {
        data: deletedShift,
        message: 'Role shift deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error deleting role shift ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete role shift');
    }
  }

  async findByDayAndTime(dayOfWeek: number, time: string) {
    try {
      this.validateTimeFormat(time);
      
      const shifts = await this.roleShiftModel.find({
        dayOfWeek,
        startTime: { $lte: time },
        endTime: { $gt: time },
        isActive: true
      }).exec();
      
      return { data: shifts };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error(`Error finding shifts for day ${dayOfWeek} and time ${time}:`, error);
      throw new InternalServerErrorException('Failed to fetch shifts by day and time');
    }
  }

  async findForBookingItem(bookingItemId: string, dayOfWeek: number) {
    try {
      const rolesResponse = await this.staffRoleService.findByBookingItem(bookingItemId);
      const qualifiedRoleIds = rolesResponse.data.map(role => role._id.toString());
      
      if (qualifiedRoleIds.length === 0) {
        return { data: [] };
      }
      
      const shifts = await this.roleShiftModel.find({
        roleId: { $in: qualifiedRoleIds },
        dayOfWeek,
        isActive: true,
        $or: [
          { applicableBookingItems: { $size: 0 } }, // Empty array means all qualified items
          { applicableBookingItems: bookingItemId }
        ]
      }).exec();
      
      return { data: shifts };
    } catch (error) {
      console.error(`Error finding shifts for booking item ${bookingItemId} on day ${dayOfWeek}:`, error);
      throw new InternalServerErrorException('Failed to fetch shifts for booking item');
    }
  }

  /**
   * Creates multiple role shift records in a batch operation
   */
  async createBulkShifts(shifts: CreateRoleShiftDto[]) {
    const session = await this.roleShiftModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        for (const shift of shifts) {
          // Validate each shift
          const roleResponse = await this.staffRoleService.findById(shift.roleId);
          const role = roleResponse.data;
          
          this.validateTimeFormat(shift.startTime);
          this.validateTimeFormat(shift.endTime);
          
          if (shift.startTime >= shift.endTime) {
            throw new BadRequestException(`Shift with start time ${shift.startTime} must end after it starts`);
          }
          
          if (shift.applicableBookingItems?.length) {
            for (const bookingItemId of shift.applicableBookingItems) {
              if (!role.qualifiedBookingItems.includes(bookingItemId)) {
                throw new BadRequestException(`Role is not qualified for booking item ${bookingItemId}`);
              }
            }
          }
          
          if (!shift.capacity) {
            shift.capacity = role.defaultCapacity;
          }
          
          shift.vendorId = role.vendorId;
        }
        
        // If all validations pass, create the shifts
        await this.roleShiftModel.insertMany(shifts, { session });
      });
      
      const createdShifts = await this.roleShiftModel.find({
        roleId: { $in: shifts.map(s => s.roleId) }
      }).sort({ createdAt: -1 }).limit(shifts.length).exec();
      
      return {
        data: createdShifts,
        message: `Successfully created ${shifts.length} role shifts`
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating bulk role shifts:', error);
      throw new InternalServerErrorException('Failed to create bulk role shifts');
    } finally {
      await session.endSession();
    }
  }
/**
 * Get all shifts for a vendor organized by day of week
 */
async getWeeklyTemplate(vendorId: string) {
  try {
    const shifts = await this.roleShiftModel.find({ 
      vendorId,
      isActive: true
    }).exec();
    
    // Fix: Properly type the weekly template array
    const weekTemplate: RoleShiftSchemaClass[][] = Array(7).fill(null).map(() => []);
    
    shifts.forEach(shift => {
      weekTemplate[shift.dayOfWeek].push(shift);
    });
    
    return {
      data: weekTemplate,
      message: 'Weekly template retrieved successfully'
    };
  } catch (error) {
    console.error(`Error getting weekly template for vendor ${vendorId}:`, error);
    throw new InternalServerErrorException('Failed to fetch weekly template');
  }
}
  /**
   * Check for conflicts between shifts
   */
  async checkShiftConflicts(roleId: string, dayOfWeek: number, startTime: string, endTime: string, excludeShiftId?: string) {
    try {
      this.validateTimeFormat(startTime);
      this.validateTimeFormat(endTime);
      
      if (startTime >= endTime) {
        throw new BadRequestException('End time must be after start time');
      }
      
      const query: any = {
        roleId,
        dayOfWeek,
        $or: [
          // New shift starts during existing shift
          { 
            startTime: { $lte: startTime },
            endTime: { $gt: startTime } 
          },
          // New shift ends during existing shift
          { 
            startTime: { $lt: endTime },
            endTime: { $gte: endTime }
          },
          // New shift completely contains existing shift
          {
            startTime: { $gte: startTime },
            endTime: { $lte: endTime }
          }
        ]
      };
      
      if (excludeShiftId) {
        query._id = { $ne: excludeShiftId };
      }
      
      const conflictingShifts = await this.roleShiftModel.find(query).exec();
      
      return {
        hasConflicts: conflictingShifts.length > 0,
        conflicts: conflictingShifts
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error checking shift conflicts:', error);
      throw new InternalServerErrorException('Failed to check shift conflicts');
    }
  }

  private validateTimeFormat(time: string): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      throw new BadRequestException('Invalid time format. Must be HH:MM in 24-hour format');
    }
  }
} 