import { Module } from '@nestjs/common';
import { BookingAssignmentController } from './booking-assignment.controller';
import { BookingAssignmentService } from './booking-assignment.service';
import { StaffUserModule } from '../staff-user/staff-user.module';
import { BookingItemModule } from '../booking-item/booking-item.module';
import { BookingAvailabilityModule } from '../booking-availability/booking-availability.module';

@Module({
  imports: [
    StaffUserModule,
    BookingItemModule,
    BookingAvailabilityModule
  ],
  controllers: [BookingAssignmentController],
  providers: [BookingAssignmentService],
  exports: [BookingAssignmentService]
})
export class BookingAssignmentModule {}