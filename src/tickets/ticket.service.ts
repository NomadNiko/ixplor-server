import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TicketSchemaClass, TicketDocument } from './infrastructure/persistence/document/entities/ticket.schema';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(TicketSchemaClass.name)
    private readonly ticketModel: Model<TicketDocument>
  ) {}

  async createTicket(ticketData: Partial<TicketSchemaClass>): Promise<TicketDocument> {
    const ticket = new this.ticketModel(ticketData);
    return ticket.save();
  }

  async findByUserId(userId: string): Promise<TicketDocument[]> {
    return this.ticketModel.find({ userId }).sort({ createdAt: -1 });
  }

  async findByTransactionId(transactionId: string): Promise<TicketDocument[]> {
    return this.ticketModel.find({ transactionId });
  }

  async markTicketAsUsed(ticketId: string): Promise<TicketDocument | null> {
    return this.ticketModel.findByIdAndUpdate(
      ticketId,
      {
        used: true,
        usedAt: new Date()
      },
      { new: true }
    );
  }
}
