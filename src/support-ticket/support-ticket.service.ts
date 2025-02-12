import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupportTicketSchemaClass, TicketStatus, TicketUpdate } from './infrastructure/persistence/document/entities/support-ticket.schema';
import { CreateSupportTicketDto } from './dto/support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { AddTicketUpdateDto } from './dto/add-ticket-update.dto';

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectModel(SupportTicketSchemaClass.name)
    private readonly ticketModel: Model<SupportTicketSchemaClass>,
  ) {}

  private transformTicket(ticket: any) {
    return {
      _id: ticket._id.toString(),
      ticketId: ticket.ticketId,
      status: ticket.status,
      createdBy: ticket.createdBy,
      createDate: ticket.createDate?.toISOString(),
      assignedTo: ticket.assignedTo,
      ticketCategory: ticket.ticketCategory,
      ticketTitle: ticket.ticketTitle,
      ticketDescription: ticket.ticketDescription,
      updates: ticket.updates?.map((update: any) => ({
        timestamp: update.timestamp?.toISOString(),
        userId: update.userId,
        updateText: update.updateText
      })),
      createdAt: ticket.createdAt?.toISOString(),
      updatedAt: ticket.updatedAt?.toISOString()
    };
  }

  private async generateTicketId(): Promise<string> {
    const latestTicket = await this.ticketModel
      .findOne({}, { ticketId: 1 })
      .sort({ ticketId: -1 })
      .lean();

    if (!latestTicket) {
      return 'SD00001';
    }

    const currentNumber = parseInt(latestTicket.ticketId.replace('SD', ''));
    const nextNumber = currentNumber + 1;
    return `SD${nextNumber.toString().padStart(5, '0')}`;
  }

  async create(createTicketDto: CreateSupportTicketDto): Promise<any> {
    try {
      const ticketId = await this.generateTicketId();
      
      const ticket = new this.ticketModel({
        ...createTicketDto,
        ticketId,
        createDate: new Date(),
        status: TicketStatus.OPENED
      });

      const savedTicket = await ticket.save();
      const ticketObj = savedTicket.toObject();
      
      return this.transformTicket(ticketObj);
    } catch (error) {
      throw new InternalServerErrorException('Failed to create support ticket');
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters: {
      status?: TicketStatus;
      category?: string;
      assignedTo?: string;
    } = {}
  ): Promise<{
    tickets: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query: any = {};

      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.category) {
        query.ticketCategory = filters.category;
      }
      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }

      const total = await this.ticketModel.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      const tickets = await this.ticketModel
        .find(query)
        .sort({ createDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec();

      return {
        tickets: tickets.map(ticket => this.transformTicket(ticket)),
        total,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch tickets');
    }
  }

  async findAllByUser(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    tickets: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const query = { createdBy: userId };
      const total = await this.ticketModel.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      const tickets = await this.ticketModel
        .find(query)
        .sort({ createDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec();

      return {
        tickets: tickets.map(ticket => this.transformTicket(ticket)),
        total,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user tickets');
    }
  }

  async findById(id: string): Promise<any> {
    const ticket = await this.ticketModel.findById(id).lean();
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return this.transformTicket(ticket);
  }

  async findByTicketId(ticketId: string): Promise<any> {
    const ticket = await this.ticketModel.findOne({ ticketId }).lean();
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
    return this.transformTicket(ticket);
  }

  async update(id: string, updateTicketDto: UpdateSupportTicketDto): Promise<any> {
    const ticket = await this.ticketModel.findByIdAndUpdate(
      id,
      { $set: updateTicketDto },
      { new: true, runValidators: true }
    ).lean();

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return this.transformTicket(ticket);
  }

  async addUpdate(id: string, updateDto: AddTicketUpdateDto): Promise<any> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const update: TicketUpdate = {
      timestamp: new Date(),
      userId: updateDto.userId,
      updateText: updateDto.updateText
    };

    ticket.updates.push(update);
    const updatedTicket = await ticket.save();
    return this.transformTicket(updatedTicket.toObject());
  }

  async updateStatus(id: string, status: TicketStatus): Promise<any> {
    const ticket = await this.ticketModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return this.transformTicket(ticket);
  }

  async assignTicket(id: string, assignedTo: string): Promise<any> {
    const ticket = await this.ticketModel.findByIdAndUpdate(
      id,
      { 
        assignedTo,
        status: TicketStatus.ASSIGNED 
      },
      { new: true }
    ).lean();

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return this.transformTicket(ticket);
  }
}