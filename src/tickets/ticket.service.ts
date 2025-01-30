import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  TicketSchemaClass, 
  TicketDocument,
  TicketStatus 
} from './infrastructure/persistence/document/entities/ticket.schema';
import { UpdateTicketDto } from './dto/update-ticket.dto';

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

  async findById(id: string): Promise<TicketDocument | null> {
    return this.ticketModel.findById(id);
  }

  async updateStatus(
    id: string, 
    status: TicketStatus,
    {
      reason,
      updatedBy
    }: {
      reason?: string;
      updatedBy: string;
    }
  ): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.status = status;
    ticket.statusUpdateReason = reason;
    ticket.statusUpdatedAt = new Date();
    ticket.statusUpdatedBy = updatedBy;

    return ticket.save();
  }

  async updateTicket(
    id: string,
    updateTicketDto: UpdateTicketDto
  ): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Update only the provided fields
    Object.assign(ticket, updateTicketDto);
    
    return ticket.save();
  }
}
