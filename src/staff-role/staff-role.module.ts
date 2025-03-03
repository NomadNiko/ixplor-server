import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffRoleController } from './staff-role.controller';
import { StaffRoleService } from './staff-role.service';
import { StaffRoleSchemaClass, StaffRoleSchema } from './infrastructure/persistence/document/entities/staff-role.schema';
import { VendorModule } from '../vendors/vendor.module';
import { BookingItemModule } from '../booking-item/booking-item.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StaffRoleSchemaClass.name,
        schema: StaffRoleSchema,
      },
    ]),
    VendorModule,
    BookingItemModule
  ],
  controllers: [StaffRoleController],
  providers: [StaffRoleService],
  exports: [StaffRoleService],
})
export class StaffRoleModule {}