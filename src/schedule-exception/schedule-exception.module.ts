import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleExceptionController } from './schedule-exception.controller';
import { ScheduleExceptionService } from './schedule-exception.service';
import { ScheduleExceptionSchemaClass, ScheduleExceptionSchema } from './infrastructure/persistence/document/entities/schedule-exception.schema';
import { VendorModule } from '../vendors/vendor.module';
import { StaffRoleModule } from '../staff-role/staff-role.module';
import { BookingItemModule } from '../booking-item/booking-item.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ScheduleExceptionSchemaClass.name,
        schema: ScheduleExceptionSchema,
      },
    ]),
    VendorModule,
    StaffRoleModule,
    BookingItemModule
  ],
  controllers: [ScheduleExceptionController],
  providers: [ScheduleExceptionService],
  exports: [ScheduleExceptionService],
})
export class ScheduleExceptionModule {}