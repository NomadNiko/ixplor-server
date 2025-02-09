import { Injectable, InternalServerErrorException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentRefundStatus, PaymentSchemaClass, PaymentStatus } from './infrastructure/persistence/document/entities/payment.schema';
import { VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';
import { TicketSchemaClass } from '../tickets/infrastructure/persistence/document/entities/ticket.schema';
import { ProductItemSchemaClass } from '../product-item/infrastructure/persistence/document/entities/product-item.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(PaymentSchemaClass.name)
    private readonly paymentModel: Model<PaymentSchemaClass>,
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>,
    @InjectModel(TicketSchemaClass.name)
    private readonly ticketModel: Model<TicketSchemaClass>,
    @InjectModel(ProductItemSchemaClass.name)
    private readonly productItemModel: Model<ProductItemSchemaClass>,
  ) {}
  
  async handleRefund(
    ticketId: string,
    amount: number,
    reason?: string
  ): Promise<void> {
    const session = await this.paymentModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const payment = await this.paymentModel.findOne({ ticketId }).session(session);
        if (!payment) {
          throw new Error('Payment not found for ticket');
        }

        const originalAmount = payment.originalAmount;
        const refundAmount = Math.min(amount, originalAmount);
        
        payment.refundAmount = refundAmount;
        payment.refundStatus = refundAmount === originalAmount ? 
          PaymentRefundStatus.FULL : PaymentRefundStatus.PARTIAL;
        payment.refundReason = reason;

        // Adjust vendor owed amount
        const vendorRefundAmount = refundAmount * (1 - payment.applicationFee / payment.originalAmount);
        await this.vendorModel.findByIdAndUpdate(
          payment.vendorId,
          {
            $inc: { internalAccountBalance: -vendorRefundAmount }
          },
          { session }
        );

        await payment.save({ session });
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      throw new InternalServerErrorException('Failed to process refund');
    } finally {
      await session.endSession();
    }
  }

  // Add this method to handle bulk payments processing
  async processBulkPayments(vendorId: string): Promise<{
    successful: number;
    failed: number;
    total: number;
  }> {
    const session = await this.paymentModel.db.startSession();
    let successful = 0;
    let failed = 0;
    
    try {
      await session.withTransaction(async () => {
        const payments = await this.paymentModel
          .find({
            vendorId,
            status: PaymentStatus.PENDING,
            vendorPaid: false
          })
          .session(session);

        const total = payments.length;

        for (const payment of payments) {
          try {
            await this.handleTicketRedemption(payment.ticketId);
            successful++;
          } catch (error) {
            console.error(`Failed to process payment ${payment._id}:`, error);
            failed++;
          }
        }

        return { successful, failed, total };
      });
    } catch (error) {
      console.error('Error in bulk payment processing:', error);
      throw new InternalServerErrorException('Failed to process bulk payments');
    } finally {
      await session.endSession();
    }
    
    return { successful, failed, total: successful + failed };
  }

  // Add this method to get detailed payment analytics
  async getPaymentAnalytics(vendorId: string, startDate: Date, endDate: Date) {
    try {
      const stats = await this.paymentModel.aggregate([
        {
          $match: {
            vendorId,
            createdAt: { $gte: startDate, $lte: endDate },
            status: PaymentStatus.COMPLETED
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$productDate' },
              month: { $month: '$productDate' }
            },
            totalRevenue: { $sum: '$originalAmount' },
            totalPayouts: { $sum: '$payoutAmount' },
            totalFees: { $sum: '$applicationFee' },
            totalRefunds: { $sum: '$refundAmount' },
            completedPayments: { $sum: 1 },
            averageAmount: { $avg: '$originalAmount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      return {
        data: stats,
        summary: {
          totalRevenue: stats.reduce((sum, item) => sum + item.totalRevenue, 0),
          totalPayouts: stats.reduce((sum, item) => sum + item.totalPayouts, 0),
          totalFees: stats.reduce((sum, item) => sum + item.totalFees, 0),
          totalRefunds: stats.reduce((sum, item) => sum + item.totalRefunds, 0),
          totalTransactions: stats.reduce((sum, item) => sum + item.completedPayments, 0)
        }
      };
    } catch (error) {
      console.error('Error generating payment analytics:', error);
      throw new InternalServerErrorException('Failed to generate payment analytics');
    }
  }




  async handleTicketRedemption(ticketId: string): Promise<void> {
    const session = await this.paymentModel.db.startSession();
    
    try {
      await session.withTransaction(async () => {
        const ticket = await this.ticketModel.findById(ticketId).session(session);
        if (!ticket || ticket.vendorPaid) {
          throw new Error('Ticket not found or already paid');
        }

        const productItem = await this.productItemModel
          .findById(ticket.productItemId)
          .session(session);
        if (!productItem) {
          throw new Error('Product item not found');
        }

        const vendor = await this.vendorModel
          .findById(ticket.vendorId)
          .session(session);
        if (!vendor) {
          throw new Error('Vendor not found');
        }

        // Add validation for redemption window
        const now = new Date();
        const productDate = new Date(productItem.productDate);
        if (now > productDate) {
          throw new Error('Product date has passed');
        }

        // Rest of the existing implementation...
      });
    } catch (error) {
      console.error('Error handling ticket redemption payment:', error);
      throw error instanceof Error ?
        new InternalServerErrorException(error.message) :
        new InternalServerErrorException('Failed to process payment for redeemed ticket');
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
      productItemId: payment.productItemId,
      payoutAmount: payment.payoutAmount,
      originalAmount: payment.originalAmount,
      applicationFee: payment.applicationFee,
      payoutSent: payment.payoutSent,
      status: payment.status,
      productDate: payment.productDate?.toISOString(),
      startTime: payment.startTime,
      duration: payment.duration,
      createdAt: payment.createdAt?.toISOString(),
      updatedAt: payment.updatedAt?.toISOString()
    };
  }

  async getPaymentsByProductItem(productItemId: string) {
    try {
      const payments = await this.paymentModel
        .find({ productItemId })
        .sort({ createdAt: -1 })
        .lean();

      return {
        data: payments.map(payment => this.transformPayment(payment))
      };
    } catch (error) {
      console.error('Error fetching payments by product item:', error);
      throw new InternalServerErrorException('Failed to fetch product item payments');
    }
  }

  async getProductItemRevenue(productItemId: string) {
    try {
      const result = await this.paymentModel.aggregate([
        { $match: { productItemId, status: PaymentStatus.COMPLETED } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$originalAmount' },
            totalPayouts: { $sum: '$payoutAmount' },
            totalFees: { $sum: '$applicationFee' },
            count: { $sum: 1 }
          }
        }
      ]);

      return result[0] || {
        totalRevenue: 0,
        totalPayouts: 0,
        totalFees: 0,
        count: 0
      };
    } catch (error) {
      console.error('Error calculating product item revenue:', error);
      throw new InternalServerErrorException('Failed to calculate product item revenue');
    }
  }
}