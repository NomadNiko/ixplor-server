import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectService } from './stripe-connect.service';
import { VendorModule } from '../vendors/vendor.module';

@Module({
  imports: [
    ConfigModule,
    VendorModule
  ],
  controllers: [StripeConnectController],
  providers: [StripeConnectService],
  exports: [StripeConnectService]
})
export class StripeConnectModule {}
