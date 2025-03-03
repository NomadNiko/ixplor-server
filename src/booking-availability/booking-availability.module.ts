import { Module } from '@nestjs/common';
import { BookingAvailabilityController } from './booking-availability.controller';
import { BookingAvailabilityService } from './booking-availability.service';
import { StaffUserModule } from '../staff-user/staff-user.module';
import { BookingItemModule } from '../booking-item/booking-item.module';

@Module({
  imports: [
    StaffUserModule,
    BookingItemModule
  ],
  controllers: [BookingAvailabilityController],
  providers: [BookingAvailabilityService],
  exports: [BookingAvailabilityService]
})
export class BookingAvailabilityModule {}