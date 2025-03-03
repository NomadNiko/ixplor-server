import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  StaffUserSchemaClass, 
  StaffUserSchemaDocument,
  ShiftObject 
} from '../infrastructure/persistence/document/entities/staff-user.schema';

@Injectable()
export class StaffShiftBulkService {
  constructor(
    @InjectModel(StaffUserSchemaClass.name)
    private readonly staffUserModel: Model<StaffUserSchemaDocument>,
  ) {}

  async createBulkShifts(
    staffId: string,
    data: { shifts: Array<{ startDateTime: Date; endDateTime: Date }> },
  ) {
    const session = await this.staffUserModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const staff = await this.staffUserModel.findById(staffId).session(session);
        if (!staff) {
          throw new BadRequestException('Staff user not found');
        }

        this.validateShifts(data.shifts);
        
        const existingShifts = staff.shifts || [];
        this.checkForOverlaps([...existingShifts, ...data.shifts]);

        const newShifts: ShiftObject[] = data.shifts.map(shift => ({
          _id: new Types.ObjectId(),
          startDateTime: new Date(shift.startDateTime),
          endDateTime: new Date(shift.endDateTime)
        }));

        staff.shifts = [...existingShifts, ...newShifts];
        staff.updatedAt = new Date();
        
        await staff.save({ session });
        return newShifts;
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async deleteBulkShifts(staffId: string, shiftIds: string[]) {
    const session = await this.staffUserModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const staff = await this.staffUserModel.findById(staffId).session(session);
        if (!staff) {
          throw new BadRequestException('Staff user not found');
        }

        // Filter out shifts to be deleted
        staff.shifts = staff.shifts.filter(
          shift => !shiftIds.includes(shift._id.toString())
        );
        staff.updatedAt = new Date();
        
        await staff.save({ session });
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateBulkShifts(
    staffId: string,
    updates: Array<{ 
      shiftId: string; 
      startDateTime?: Date; 
      endDateTime?: Date;
    }>
  ) {
    const session = await this.staffUserModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const staff = await this.staffUserModel.findById(staffId).session(session);
        if (!staff) {
          throw new BadRequestException('Staff user not found');
        }

        const updatedShifts = [...staff.shifts];
        
        // Apply updates
        updates.forEach(update => {
          const shiftIndex = updatedShifts.findIndex(
            shift => shift._id.toString() === update.shiftId
          );
          
          if (shiftIndex === -1) {
            throw new BadRequestException(`Shift ${update.shiftId} not found`);
          }

          if (update.startDateTime) {
            updatedShifts[shiftIndex].startDateTime = new Date(update.startDateTime);
          }
          if (update.endDateTime) {
            updatedShifts[shiftIndex].endDateTime = new Date(update.endDateTime);
          }
        });

        // Validate all shifts after updates
        this.validateShifts(updatedShifts);
        this.checkForOverlaps(updatedShifts);

        staff.shifts = updatedShifts;
        staff.updatedAt = new Date();
        
        await staff.save({ session });
      });
    } catch (error) {
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private validateShifts(shifts: Array<{ startDateTime: Date; endDateTime: Date }>) {
    if (!Array.isArray(shifts)) {
      throw new BadRequestException('Shifts must be an array');
    }

    for (const shift of shifts) {
      const startTime = new Date(shift.startDateTime).getTime();
      const endTime = new Date(shift.endDateTime).getTime();

      if (startTime >= endTime) {
        throw new BadRequestException(
          'Shift end time must be after start time'
        );
      }

      const duration = (endTime - startTime) / (1000 * 60 * 60); // hours
      if (duration > 12) {
        throw new BadRequestException(
          'Maximum shift duration is 12 hours'
        );
      }

      if (duration < 1) {
        throw new BadRequestException(
          'Minimum shift duration is 1 hour'
        );
      }
    }
  }

   private checkForOverlaps(shifts: Array<{ startDateTime: Date | string; endDateTime: Date | string }>) {
    const sortedShifts = [...shifts].sort((a, b) => 
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );

    for (let i = 0; i < sortedShifts.length - 1; i++) {
      const currentShift = sortedShifts[i];
      const nextShift = sortedShifts[i + 1];

      if (new Date(currentShift.endDateTime) > new Date(nextShift.startDateTime)) {
        throw new ConflictException(
          'Shifts cannot overlap'
        );
      }

      const breakTime = (new Date(nextShift.startDateTime).getTime() - 
                        new Date(currentShift.endDateTime).getTime()) / (1000 * 60); // minutes
      if (breakTime < 30) {
        throw new BadRequestException(
          'Minimum break between shifts must be 30 minutes'
        );
      }
    }
  }
}