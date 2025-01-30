import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { VendorModule } from '../vendors/vendor.module';
import { TicketSchemaClass, TicketSchema } from './infrastructure/persistence/document/entities/ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: TicketSchemaClass.name,
        schema: TicketSchema,
      },
    ]),
    VendorModule,
  ],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}