import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  StaffScheduleSchemaClass, 
  StaffScheduleSchemaDocument,
  StaffScheduleStatusEnum 
} from './infrastructure/persistence/document/entities/staff-schedule.schema';
import { StaffUserService } from '../staff-user/staff-user.service';
import { StaffRoleService } from '../staff-role/staff-role.service';
import { RoleShiftService } from '../role-shift/role-shift.service';
import { CreateStaffScheduleDto } from './dto/create-staff-schedule.dto';
import { UpdateStaffScheduleDto } from './dto/update-staff-schedule.dto';

@Injectable()
export class StaffScheduleService {
  constructor(
    @InjectModel(StaffScheduleSchemaClass.name)
    private readonly staffScheduleModel: Model<StaffScheduleSchemaDocument>,
    private readonly staffUserService: StaffUserService,
    private readonly staffRoleService: StaffRoleService,
    private readonly roleShiftService: RoleShiftService,
  ) {}

  async create(createStaffScheduleDto: CreateStaffScheduleDto) {
    try {
      // Verify staff exists and is active
      const staffResponse = await this.staffUserService.findById(createStaffScheduleDto.staffId);
      if (!staffResponse.data) {
        throw new NotFoundException(`Staff with ID ${createStaffScheduleDto.staffId} not found`);
      }
      if (staffResponse.data.status !== 'ACTIVE') {
        throw new BadRequestException('Staff member is not active');
      }

      // Verify role exists and is active
      const roleResponse = await this.staffRoleService.findById(createStaffScheduleDto.roleId);
      if (!roleResponse.data) {
        throw new NotFoundException(`Role with ID ${createStaffScheduleDto.roleId} not found`);
      }
      if (!roleResponse.data.isActive) {
        throw new BadRequestException('Role is not active');
      }

      // Verify staff is qualified for this role
      if (!staffResponse.data.roleQualifications.includes(createStaffScheduleDto.roleId)) {
        throw new BadRequestException('Staff member is not qualified for this role');
      }

      // Check for scheduling conflicts
      const hasConflict = await this.checkForSchedulingConflicts(
        createStaffScheduleDto.staffId,
        createStaffScheduleDto.date,
        createStaffScheduleDto.startTime,
        createStaffScheduleDto.endTime
      );
      if (hasConflict) {
        throw new ConflictException('Staff member already has a scheduling conflict for this time');
      }

      // Create the schedule entry
      const staffSchedule = new this.staffScheduleModel(createStaffScheduleDto);
      const savedSchedule = await staffSchedule.save();

      return {
        data: savedSchedule,
        message: 'Staff schedule created successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException || 
          error instanceof ConflictException) {
        throw error;
      }
      console.error('Error creating staff schedule:', error);
      throw new InternalServerErrorException('Failed to create staff schedule');
    }
  }

  async findById(id: string) {
    try {
      const schedule = await this.staffScheduleModel.findById(id).exec();
      if (!schedule) {
        throw new NotFoundException(`Staff schedule with ID ${id} not found`);
      }
      return { data: schedule };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error finding staff schedule ${id}:`, error);
      throw new InternalServerErrorException('Failed to fetch staff schedule');
    }
  }

  async findByVendor(vendorId: string, date?: Date, status?: StaffScheduleStatusEnum) {
    try {
      const query: any = { vendorId };
      
      if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        query.date = { $gte: startDate, $lte: endDate };
      }
      
      if (status) {
        query.status = status;
      }
      
      const schedules = await this.staffScheduleModel
        .find(query)
        .sort({ date: 1, startTime: 1 })
        .exec();
      
      return { data: schedules };
    } catch (error) {
      console.error(`Error finding schedules for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to fetch vendor schedules');
    }
  }

  async findByStaff(staffId: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { staffId };
      
      if (startDate || endDate) {
        query.date = {};
        
        if (startDate) {
          query.date.$gte = startDate;
        }
        
        if (endDate) {
          query.date.$lte = endDate;
        }
      }
      
      const schedules = await this.staffScheduleModel
        .find(query)
        .sort({ date: 1, startTime: 1 })
        .exec();
      
      return { data: schedules };
    } catch (error) {
      console.error(`Error finding schedules for staff ${staffId}:`, error);
      throw new InternalServerErrorException('Failed to fetch staff schedules');
    }
  }

  async findByRole(roleId: string, startDate?: Date, endDate?: Date) {
    try {
      const query: any = { roleId };
      
      if (startDate || endDate) {
        query.date = {};
        
        if (startDate) {
          query.date.$gte = startDate;
        }
        
        if (endDate) {
          query.date.$lte = endDate;
        }
      }
      
      const schedules = await this.staffScheduleModel
        .find(query)
        .sort({ date: 1, startTime: 1 })
        .exec();
      
      return { data: schedules };
    } catch (error) {
      console.error(`Error finding schedules for role ${roleId}:`, error);
      throw new InternalServerErrorException('Failed to fetch role schedules');
    }
  }

  async findStaffAssignmentForRole(roleId: string, date: Date) {
    try {
      const scheduleDate = new Date(date);
      scheduleDate.setHours(0, 0, 0, 0);
      
      const timeString = this.formatTimeFromDate(date);
      
      const schedule = await this.staffScheduleModel.findOne({
        roleId,
        date: scheduleDate,
        startTime: { $lte: timeString },
        endTime: { $gt: timeString },
        status: StaffScheduleStatusEnum.PUBLISHED
      }).exec();
      
      return schedule;
    } catch (error) {
      console.error(`Error finding staff assignment for role ${roleId} at ${date}:`, error);
      throw new InternalServerErrorException('Failed to fetch staff assignment');
    }
  }

  async update(id: string, updateStaffScheduleDto: UpdateStaffScheduleDto) {
    try {
      const schedule = await this.staffScheduleModel.findById(id);
      if (!schedule) {
        throw new NotFoundException(`Staff schedule with ID ${id} not found`);
      }
      
      // If staff is being changed, verify qualifications
      if (updateStaffScheduleDto.staffId && updateStaffScheduleDto.staffId !== schedule.staffId) {
        const staffResponse = await this.staffUserService.findById(updateStaffScheduleDto.staffId);
        if (!staffResponse.data) {
          throw new NotFoundException(`Staff with ID ${updateStaffScheduleDto.staffId} not found`);
        }
        if (staffResponse.data.status !== 'ACTIVE') {
          throw new BadRequestException('New staff member is not active');
        }
        if (!staffResponse.data.roleQualifications.includes(schedule.roleId)) {
          throw new BadRequestException('New staff member is not qualified for this role');
        }
      }
      
      // Check for conflicts if time or date is being changed
      if (updateStaffScheduleDto.date || updateStaffScheduleDto.startTime || updateStaffScheduleDto.endTime) {
        const staffId = updateStaffScheduleDto.staffId || schedule.staffId;
        const date = updateStaffScheduleDto.date || schedule.date;
        const startTime = updateStaffScheduleDto.startTime || schedule.startTime;
        const endTime = updateStaffScheduleDto.endTime || schedule.endTime;
        
        const hasConflict = await this.checkForSchedulingConflicts(
          staffId,
          date,
          startTime,
          endTime,
          id
        );
        
        if (hasConflict) {
          throw new ConflictException('Staff member has a scheduling conflict for this time');
        }
      }
      
      const updatedSchedule = await this.staffScheduleModel.findByIdAndUpdate(
        id,
        updateStaffScheduleDto,
        { new: true }
      );
      
      return {
        data: updatedSchedule,
        message: 'Staff schedule updated successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException || 
          error instanceof BadRequestException || 
          error instanceof ConflictException) {
        throw error;
      }
      console.error(`Error updating staff schedule ${id}:`, error);
      throw new InternalServerErrorException('Failed to update staff schedule');
    }
  }

  async remove(id: string) {
    try {
      const schedule = await this.staffScheduleModel.findByIdAndDelete(id);
      if (!schedule) {
        throw new NotFoundException(`Staff schedule with ID ${id} not found`);
      }
      return {
        message: 'Staff schedule deleted successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error deleting staff schedule ${id}:`, error);
      throw new InternalServerErrorException('Failed to delete staff schedule');
    }
  }

  async updateStatus(id: string, status: StaffScheduleStatusEnum) {
    try {
      const schedule = await this.staffScheduleModel.findByIdAndUpdate(
        id,
        { status, updatedAt: new Date() },
        { new: true }
      );
      
      if (!schedule) {
        throw new NotFoundException(`Staff schedule with ID ${id} not found`);
      }
      
      return {
        data: schedule,
        message: `Staff schedule ${status === StaffScheduleStatusEnum.PUBLISHED ? 'published' : 'updated'} successfully`
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(`Error updating staff schedule status ${id}:`, error);
      throw new InternalServerErrorException('Failed to update staff schedule status');
    }
  }

  async publishSchedules(vendorId: string, startDate: Date, endDate: Date) {
    try {
      const result = await this.staffScheduleModel.updateMany(
        {
          vendorId,
          date: { $gte: startDate, $lte: endDate },
          status: StaffScheduleStatusEnum.DRAFT
        },
        {
          status: StaffScheduleStatusEnum.PUBLISHED,
          updatedAt: new Date()
        }
      );
      
      return {
        message: `Published ${result.modifiedCount} schedules successfully`,
        count: result.modifiedCount
      };
    } catch (error) {
      console.error(`Error publishing schedules for vendor ${vendorId}:`, error);
      throw new InternalServerErrorException('Failed to publish schedules');
    }
  }

  async generateFromRoleShifts(vendorId: string, startDate: Date, endDate: Date) {
    const session = await this.staffScheduleModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        // Fix: Use StaffScheduleSchemaDocument instead of StaffScheduleSchemaClass
        const generatedSchedules: StaffScheduleSchemaDocument[] = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          const roleShiftsResponse = await this.roleShiftService.findByVendor(vendorId);
          
          for (const roleShift of roleShiftsResponse.data) {
            if (roleShift.dayOfWeek === dayOfWeek && roleShift.isActive) {
              const existingSchedule = await this.staffScheduleModel.findOne({
                vendorId,
                roleId: roleShift.roleId,
                date: new Date(currentDate),
                startTime: roleShift.startTime,
                endTime: roleShift.endTime
              }).session(session);
              
              if (!existingSchedule) {
                const schedule = new this.staffScheduleModel({
                  vendorId,
                  roleId: roleShift.roleId,
                  date: new Date(currentDate),
                  startTime: roleShift.startTime,
                  endTime: roleShift.endTime,
                  status: StaffScheduleStatusEnum.DRAFT
                });
                
                await schedule.save({ session });
                generatedSchedules.push(schedule);
              }
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        result = {
          message: `Generated ${generatedSchedules.length} draft schedules`,
          count: generatedSchedules.length
        };
      });
      return result;
    } catch (error) {
      console.error(`Error generating schedules from shifts:`, error);
      throw new InternalServerErrorException('Failed to generate schedules');
    } finally {
      await session.endSession();
    }
  }
  // Utility Functions
  
  private async checkForSchedulingConflicts(
    staffId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeScheduleId?: string
  ): Promise<boolean> {
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);
    
    const query: any = {
      staffId,
      date: scheduleDate,
      $or: [
        { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
        { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
        { startTime: { $gte: startTime }, endTime: { $lte: endTime } }
      ]
    };
    
    if (excludeScheduleId) {
      query._id = { $ne: excludeScheduleId };
    }
    
    const conflictingSchedules = await this.staffScheduleModel.countDocuments(query);
    
    return conflictingSchedules > 0;
  }
  
  private formatTimeFromDate(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}