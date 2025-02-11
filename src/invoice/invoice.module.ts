import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { TransactionSchemaClass, TransactionSchema } from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { VendorModule } from '../vendors/vendor.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TransactionSchemaClass.name, schema: TransactionSchema }
    ]),
    VendorModule
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService]
})
export class InvoiceModule {}