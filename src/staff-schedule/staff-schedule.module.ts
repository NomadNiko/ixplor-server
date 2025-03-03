import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffScheduleController } from './staff-schedule.controller';
import { StaffScheduleService } from './staff-schedule.service';
import { StaffScheduleSchemaClass, StaffScheduleSchema } from './infrastructure/persistence/document/entities/staff-schedule.schema';
import { StaffRoleModule } from '../staff-role/staff-role.module';
import { StaffUserModule } from '../staff-user/staff-user.module';
import { VendorModule } from '../vendors/vendor.module';
import { RoleShiftModule } from '../role-shift/role-shift.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StaffScheduleSchemaClass.name,
        schema: StaffScheduleSchema,
      },
    ]),
    StaffRoleModule,
    StaffUserModule,
    VendorModule,
    RoleShiftModule
  ],
  controllers: [StaffScheduleController],
  providers: [StaffScheduleService],
  exports: [StaffScheduleService],
})
export class StaffScheduleModule {}