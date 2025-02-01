import { Injectable, InternalServerErrorException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentSchemaClass, PaymentStatus } from './infrastructure/persistence/document/entities/payment.schema';
import { VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';
import { TicketSchemaClass } from '../tickets/infrastructure/persistence/document/entities/ticket.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(PaymentSchemaClass.name)
    private readonly paymentModel: Model<PaymentSchemaClass>,
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>,
    @InjectModel(TicketSchemaClass.name)
    private readonly ticketModel: Model<TicketSchemaClass>,
  ) {}
  
  async handleTicketRedemption(ticketId: string): Promise<void> {
    const session = await this.paymentModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Get ticket and validate
        const ticket = await this.ticketModel.findById(ticketId).session(session);
        if (!ticket || ticket.vendorPaid) {
          throw new Error('Ticket not found or already paid');
        }

        // Get vendor info
        const vendor = await this.vendorModel.findById(ticket.vendorId).session(session);
        if (!vendor) {
          throw new Error('Vendor not found');
        }

        // Create payment record
        const payment = new this.paymentModel({
          ticketId: ticket._id,
          transactionId: ticket.transactionId,
          vendorId: vendor._id,
          customerId: ticket.userId,
          payoutAmount: ticket.vendorOwed,
          originalAmount: ticket.productPrice,
          applicationFee: ticket.productPrice * vendor.vendorApplicationFee,
          status: PaymentStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const savedPayment = await payment.save({ session });

        // Update vendor balance
        await this.vendorModel.findByIdAndUpdate(
          vendor._id,
          {
            $inc: { internalAccountBalance: ticket.vendorOwed },
            $push: { vendorPayments: savedPayment._id }
          },
          { session }
        );

        // Mark ticket as paid
        await this.ticketModel.findByIdAndUpdate(
          ticket._id,
          { vendorPaid: true },
          { session }
        );
      });
    } catch (error) {
      console.error('Error handling ticket redemption payment:', error);
      throw new InternalServerErrorException('Failed to process payment for redeemed ticket');
    } finally {
      await session.endSession();
    }
  }

  private transformPayment(payment: any) {
    return {
      _id: payment._id.toString(),
      ticketId: payment.ticketId,
      transactionId: payment.transactionId,
      vendorId: payment.vendorId,
      customerId: payment.customerId,
      payoutAmount: payment.payoutAmount,
      originalAmount: payment.originalAmount,
      applicationFee: payment.applicationFee,
      payoutSent: payment.payoutSent,
      status: payment.status,
      createdAt: payment.createdAt?.toISOString(),
      updatedAt: payment.updatedAt?.toISOString()
    };
  }
}