import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportTicketController } from './support-ticket.controller';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketSchemaClass, SupportTicketSchema } from './infrastructure/persistence/document/entities/support-ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicketSchemaClass.name, schema: SupportTicketSchema },
    ]),
  ],
  controllers: [SupportTicketController],
  providers: [SupportTicketService],
  exports: [SupportTicketService],
})
export class SupportTicketModule {}