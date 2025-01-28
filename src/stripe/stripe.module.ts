import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { TransactionModule } from '../transactions/transaction.module';
import { VendorModule } from '../vendors/vendor.module';

@Module({
  imports: [TransactionModule, VendorModule],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}