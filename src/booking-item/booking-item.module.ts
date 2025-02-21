import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingItemController } from './booking-item.controller';
import { BookingItemService } from './booking-item.service';
import {
  BookingItemSchemaClass,
  BookingItemSchema,
} from './infrastructure/persistence/document/entities/booking-item.schema';
import { VendorModule } from '../vendors/vendor.module';
import { BookingItemQueryService } from './services/booking-item-query.service';
import { BookingItemManagementService } from './services/booking-item-management.service';
import { BookingItemTransformService } from './services/booking-item-transform.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: BookingItemSchemaClass.name,
        schema: BookingItemSchema,
      },
    ]),
    VendorModule,
  ],
  controllers: [BookingItemController],
  providers: [
    BookingItemService,
    BookingItemQueryService,
    BookingItemManagementService,
    BookingItemTransformService,
  ],
  exports: [BookingItemService],
})
export class BookingItemModule {}