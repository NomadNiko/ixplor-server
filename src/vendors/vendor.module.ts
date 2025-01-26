import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorController } from './vendor.controller';
import { VendorV1Controller } from './controllers/vendor-v1.controller';
import { VendorService } from './vendor.service';
import {
  VendorSchemaClass,
  VendorSchema,
} from './infrastructure/persistence/document/entities/vendor.schema';
import {
  UserSchemaClass,
  UserSchema,
} from '../users/infrastructure/persistence/document/entities/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: VendorSchemaClass.name,
        schema: VendorSchema,
      },
      {
        name: UserSchemaClass.name,
        schema: UserSchema,
      }
    ]),
  ],
  controllers: [VendorController, VendorV1Controller],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}