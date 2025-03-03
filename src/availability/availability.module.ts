import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AvailabilityService } from './availability.service';
import { RoleShiftSchemaClass, RoleShiftSchema } from '../role-shift/infrastructure/persistence/document/entities/role-shift.schema';
import { StaffRoleSchemaClass, StaffRoleSchema } from '../staff-role/infrastructure/persistence/document/entities/staff-role.schema';
import { StaffScheduleSchemaClass, StaffScheduleSchema } from '../staff-schedule/infrastructure/persistence/document/entities/staff-schedule.schema';
import { BookingCalendarSchemaClass, BookingCalendarSchema } from '../booking-calendar/infrastructure/persistence/document/entities/booking-calendar.schema';
import { ScheduleExceptionSchemaClass, ScheduleExceptionSchema } from '../schedule-exception/infrastructure/persistence/document/entities/schedule-exception.schema';
import { BookingItemModule } from '../booking-item/booking-item.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RoleShiftSchemaClass.name,
        schema: RoleShiftSchema,
      },
      {
        name: StaffRoleSchemaClass.name,
        schema: StaffRoleSchema,
      },
      {
        name: StaffScheduleSchemaClass.name,
        schema: StaffScheduleSchema,
      },
      {
        name: BookingCalendarSchemaClass.name,
        schema: BookingCalendarSchema,
      },
      {
        name: ScheduleExceptionSchemaClass.name,
        schema: ScheduleExceptionSchema,
      },
    ]),
    BookingItemModule,
  ],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}