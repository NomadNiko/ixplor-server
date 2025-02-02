import { Injectable, NotFoundException, BadRequestException, forwardRef, Inject, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  TicketSchemaClass, 
  TicketDocument, 
  TicketStatus 
} from './infrastructure/persistence/document/entities/ticket.schema';
import { VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';
import { PaymentService } from '../payment/payment.service';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class TicketService {
  constructor(
    @InjectModel(TicketSchemaClass.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
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
      vendorOwed: ticketObj.vendorOwed,
      vendorPaid: ticketObj.vendorPaid,
      createdAt: ticketObj.createdAt?.toISOString(),
      updatedAt: ticketObj.updatedAt?.toISOString()
    };
  }

  async createTicket(ticketData: Partial<TicketSchemaClass>): Promise<any> {
    // Get vendor to calculate fee
    const vendor = await this.vendorModel.findById(ticketData.vendorId);
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (!ticketData.productPrice) {
      throw new BadRequestException('Product price is required');
    }

    // Calculate vendor owed amount (price minus application fee)
    const vendorOwed = ticketData.productPrice * (1 - (vendor.vendorApplicationFee || 0.13));

    // Create ticket with vendorOwed amount
    const ticket = new this.ticketModel({
      ...ticketData,
      vendorOwed,
      vendorPaid: false,
      status: TicketStatus.ACTIVE
    });

    const savedTicket = await ticket.save();
    return this.transformTicket(savedTicket);
  }

  async findByVendorId(vendorId: string) {
    try {
      const tickets = await this.ticketModel
        .find({ vendorId })
        .sort({ createdAt: -1 });
        
      return {
        data: tickets.map(ticket => this.transformTicket(ticket)),
      };
    } catch (error) {
      console.error('Error finding tickets for vendor:', error);
      throw new InternalServerErrorException('Failed to fetch vendor tickets');
    }
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

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.statusUpdateReason = reason;
    ticket.statusUpdatedAt = new Date();
    ticket.statusUpdatedBy = updatedBy;

    const updatedTicket = await ticket.save();

    // If status changed to REDEEMED, trigger payment processing
    if (status === TicketStatus.REDEEMED && oldStatus !== TicketStatus.REDEEMED) {
      await this.paymentService.handleTicketRedemption(id);
    }

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

    // Don't allow updating vendorOwed or vendorPaid through this method
    delete updateTicketDto['vendorOwed'];
    delete updateTicketDto['vendorPaid'];

    Object.assign(ticket, updateTicketDto);
    const updatedTicket = await ticket.save();
    return this.transformTicket(updatedTicket);
  }

  async findByTransactionId(transactionId: string) {
    const tickets = await this.ticketModel.find({ transactionId });
    return tickets.map(ticket => this.transformTicket(ticket));
  }

  async markTicketAsUsed(ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId);
    
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.used) {
      throw new BadRequestException('Ticket has already been used');
    }

    ticket.used = true;
    ticket.usedAt = new Date();
    
    const updatedTicket = await ticket.save();
    return this.transformTicket(updatedTicket);
  }

  async findPendingPaymentTickets(vendorId: string) {
    const tickets = await this.ticketModel.find({
      vendorId,
      status: TicketStatus.REDEEMED,
      vendorPaid: false
    }).sort({ updatedAt: 1 });
    
    return tickets.map(ticket => this.transformTicket(ticket));
  }

  async markTicketAsPaid(ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId);
    
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.vendorPaid) {
      throw new BadRequestException('Ticket has already been paid');
    }

    ticket.vendorPaid = true;
    const updatedTicket = await ticket.save();
    
    return this.transformTicket(updatedTicket);
  }
}