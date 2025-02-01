import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
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
import {
  TransactionSchemaClass,
  TransactionSchema,
} from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { StripeConnectModule } from '../stripe-connect/stripe-connect.module';

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
      },
      {
        name: TransactionSchemaClass.name,
        schema: TransactionSchema,
      }
    ]),
    ConfigModule,
    StripeConnectModule
  ],
  controllers: [VendorController, VendorV1Controller],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}