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

  private transformTicket(ticket: TicketDocument) {
    const ticketObj = ticket.toObject();
    return {
      _id: ticketObj._id.toString(),
      userId: ticketObj.userId,
      transactionId: ticketObj.transactionId,
      vendorId: ticketObj.vendorId,
      productId: ticketObj.productId,
      productName: ticketObj.productName,
      productDescription: ticketObj.productDescription,
      productPrice: ticketObj.productPrice,
      productType: ticketObj.productType,
      productDuration: ticketObj.productDuration,
      productDate: ticketObj.productDate?.toISOString(),
      productStartTime: ticketObj.productStartTime,
      productLocation: ticketObj.productLocation ? {
        type: ticketObj.productLocation.type,
        coordinates: ticketObj.productLocation.coordinates
      } : undefined,
      productImageURL: ticketObj.productImageURL,
      productAdditionalInfo: ticketObj.productAdditionalInfo,
      productRequirements: ticketObj.productRequirements,
      productWaiver: ticketObj.productWaiver,
      quantity: ticketObj.quantity,
      used: ticketObj.used,
      usedAt: ticketObj.usedAt?.toISOString(),
      status: ticketObj.status,
      statusUpdateReason: ticketObj.statusUpdateReason,
      statusUpdatedAt: ticketObj.statusUpdatedAt?.toISOString(),
      statusUpdatedBy: ticketObj.statusUpdatedBy,
      createdAt: ticketObj.createdAt?.toISOString(),
      updatedAt: ticketObj.updatedAt?.toISOString()
    };
  }

  async createTicket(ticketData: Partial<TicketSchemaClass>): Promise<any> {
    const ticket = new this.ticketModel(ticketData);
    const savedTicket = await ticket.save();
    return this.transformTicket(savedTicket);
  }

  async findByUserId(userId: string) {
    const tickets = await this.ticketModel
      .find({ userId })
      .sort({ createdAt: -1 });
    return tickets.map(ticket => this.transformTicket(ticket));
  }

  async findById(id: string) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return this.transformTicket(ticket);
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
  ) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.status = status;
    ticket.statusUpdateReason = reason;
    ticket.statusUpdatedAt = new Date();
    ticket.statusUpdatedBy = updatedBy;

    const updatedTicket = await ticket.save();
    return this.transformTicket(updatedTicket);
  }

  async updateTicket(
    id: string,
    updateTicketDto: UpdateTicketDto
  ) {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    Object.assign(ticket, updateTicketDto);
    const updatedTicket = await ticket.save();
    return this.transformTicket(updatedTicket);
  }

  async findByTransactionId(transactionId: string) {
    const tickets = await this.ticketModel.find({ transactionId });
    return tickets.map(ticket => this.transformTicket(ticket));
  }

  async markTicketAsUsed(ticketId: string) {
    const ticket = await this.ticketModel.findByIdAndUpdate(
      ticketId,
      {
        used: true,
        usedAt: new Date()
      },
      { new: true }
    );
    
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.transformTicket(ticket);
  }
}