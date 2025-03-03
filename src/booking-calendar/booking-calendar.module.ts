import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingCalendarController } from './booking-calendar.controller';
import { BookingCalendarService } from './booking-calendar.service';
import { BookingCalendarSchemaClass, BookingCalendarSchema } from './infrastructure/persistence/document/entities/booking-calendar.schema';
import { StaffRoleModule } from '../staff-role/staff-role.module';
import { RoleShiftModule } from '../role-shift/role-shift.module';
import { StaffScheduleModule } from '../staff-schedule/staff-schedule.module';
import { BookingItemModule } from '../booking-item/booking-item.module';
import { VendorModule } from '../vendors/vendor.module';
import { ScheduleExceptionModule } from '../schedule-exception/schedule-exception.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: BookingCalendarSchemaClass.name,
        schema: BookingCalendarSchema,
      },
    ]),
    StaffRoleModule,
    RoleShiftModule,
    StaffScheduleModule,
    BookingItemModule,
    VendorModule,
    ScheduleExceptionModule
  ],
  controllers: [BookingCalendarController],
  providers: [BookingCalendarService],
  exports: [BookingCalendarService],
})
export class BookingCalendarModule {}