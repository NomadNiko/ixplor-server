import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffUserController } from './staff-user.controller';
import { StaffUserService } from './staff-user.service';
import {
  StaffUserSchemaClass,
  StaffUserSchema,
} from './infrastructure/persistence/document/entities/staff-user.schema';
import { StaffUserQueryService } from './services/staff-user-query.service';
import { StaffUserManagementService } from './services/staff-user-management.service';
import { StaffUserTransformService } from './services/staff-user-transform.service';
import { VendorModule } from '../vendors/vendor.module';
import { StaffShiftBulkService } from './services/staff-shift-bulk.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: StaffUserSchemaClass.name,
        schema: StaffUserSchema,
      },
    ]),
    VendorModule,
  ],
  controllers: [StaffUserController],
  providers: [
    StaffUserService,
    StaffUserQueryService,
    StaffUserManagementService,
    StaffUserTransformService,
    StaffShiftBulkService,
  ],
  exports: [StaffUserService],
})
export class StaffUserModule {}