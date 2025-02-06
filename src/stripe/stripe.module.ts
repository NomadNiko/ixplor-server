import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TransactionModule } from '../transactions/transaction.module';
import { VendorModule } from '../vendors/vendor.module';
import { CartModule } from '../cart/cart.module';
import { ProductModule } from '../products/product.module';
import { TicketModule } from '../tickets/ticket.module';
import { PayoutSchemaClass, PayoutSchema } from '../payout/infrastructure/persistence/document/entities/payout.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PayoutSchemaClass.name, schema: PayoutSchema }
    ]),
    TransactionModule,
    VendorModule,
    CartModule,
    ProductModule,
    TicketModule
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}