import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentSchemaClass, PaymentSchema } from './infrastructure/persistence/document/entities/payment.schema';
import { VendorModule } from '../vendors/vendor.module';
import { TicketModule } from '../tickets/ticket.module';
import { VendorSchema, VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';
import { TicketSchema, TicketSchemaClass } from '../tickets/infrastructure/persistence/document/entities/ticket.schema';
import { ProductItemSchema, ProductItemSchemaClass } from '../product-item/infrastructure/persistence/document/entities/product-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PaymentSchemaClass.name,
        schema: PaymentSchema,
      },
      { 
        name: VendorSchemaClass.name, 
        schema: VendorSchema 
      },
      { 
        name: TicketSchemaClass.name, 
        schema: TicketSchema 
      },
      {
        name: ProductItemSchemaClass.name,
        schema: ProductItemSchema
      }
    ]),
    VendorModule,
    forwardRef(() => TicketModule) // Handle circular dependency with TicketModule
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}