import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { VendorController } from './vendor.controller';
import { VendorV1Controller } from './controllers/vendor-v1.controller';

// Services
import { VendorService } from './vendor.service';
import { VendorCrudService } from './services/vendor-crud.service';
import { VendorSearchService } from './services/vendor-search.service';
import { VendorStripeService } from './services/vendor-stripe.service';
import { VendorOwnerService } from './services/vendor-owner.service';
import { VendorProductService } from './services/vendor-product.service';

// Schemas
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

// External Modules
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
  controllers: [
    VendorController,
    VendorV1Controller
  ],
  providers: [
    // Main Service
    VendorService,
    // Sub-services
    VendorCrudService,
    VendorSearchService,
    VendorStripeService,
    VendorOwnerService,
    VendorProductService,
  ],
  exports: [
    VendorService,
    VendorCrudService,
    VendorSearchService,
    VendorStripeService,
    VendorOwnerService,
    VendorProductService,
  ]
})
export class VendorModule {}