import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketService } from './ticket.service';
import { TicketSchemaClass, TicketSchema } from './infrastructure/persistence/document/entities/ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: TicketSchemaClass.name,
        schema: TicketSchema,
      },
    ]),
  ],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}