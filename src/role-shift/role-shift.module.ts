import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleShiftController } from './role-shift.controller';
import { RoleShiftService } from './role-shift.service';
import { RoleShiftSchemaClass, RoleShiftSchema } from './infrastructure/persistence/document/entities/role-shift.schema';
import { StaffRoleModule } from '../staff-role/staff-role.module';
import { VendorModule } from '../vendors/vendor.module';
import { BookingItemModule } from '../booking-item/booking-item.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RoleShiftSchemaClass.name,
        schema: RoleShiftSchema,
      },
    ]),
    StaffRoleModule,
    VendorModule,
    BookingItemModule
  ],
  controllers: [RoleShiftController],
  providers: [RoleShiftService],
  exports: [RoleShiftService],
})
export class RoleShiftModule {} 