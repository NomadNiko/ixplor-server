import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TransactionModule } from '../transactions/transaction.module';
import { VendorModule } from '../vendors/vendor.module';
import { CartModule } from '../cart/cart.module';
import { ProductModule } from '../products/product.module';
import { TicketModule } from '../tickets/ticket.module';

@Module({
  imports: [
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