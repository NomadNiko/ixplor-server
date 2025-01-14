import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import {
  VendorSchemaClass,
  VendorSchema,
} from './infrastructure/persistence/document/entities/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: VendorSchemaClass.name,
        schema: VendorSchema,
      },
    ]),
  ],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}