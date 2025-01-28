import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TransactionSchemaClass, TransactionDocument, TransactionStatus, TransactionType } from './infrastructure/persistence/document/entities/transaction.schema';
import { TransactionFilters } from './types/transaction-filters.type';
import { PaginationOptions } from './types/transaction-pagination.type';

@Injectable()
export class TransactionService {
  constructor(
    @InjectModel(TransactionSchemaClass.name)
    private readonly transactionModel: Model<TransactionDocument>
  ) {}

  async create(transactionData: Partial<TransactionSchemaClass>) {
    const transaction = new this.transactionModel(transactionData);
    return transaction.save();
  }

  async findByPaymentIntentId(paymentIntentId: string) {
    const transaction = await this.transactionModel.findOne({ 
      stripePaymentIntentId: paymentIntentId 
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async updateTransactionStatus(
    paymentIntentId: string, 
    status: TransactionStatus,
    additionalData: Partial<TransactionSchemaClass> = {}
  ) {
    const transaction = await this.transactionModel.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      { 
        $set: {
          status,
          ...additionalData,
          updatedAt: new Date()
        }
      },
      { new: true }
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async findByVendorId(vendorId: string) {
    return this.transactionModel.find({ vendorId }).sort({ createdAt: -1 });
  }

  async findByCustomerId(customerId: string) {
    return this.transactionModel.find({ customerId }).sort({ createdAt: -1 });
  }

  async findWithPagination(
    filters: TransactionFilters,
    paginationOptions: PaginationOptions
  ) {
    const query: any = {};
  
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }
  
    if (filters.status?.length) {
      query.status = { $in: filters.status };
    }
  
    if (filters.type?.length) {
      query.type = { $in: filters.type };
    }
  
    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) {
        query.amount.$gte = filters.minAmount;
      }
      if (filters.maxAmount) {
        query.amount.$lte = filters.maxAmount;
      }
    }
  
    const total = await this.transactionModel.countDocuments(query);
    const totalPages = Math.ceil(total / paginationOptions.limit);
  
    const sortOptions: any = {};
    if (paginationOptions.sortBy) {
      sortOptions[paginationOptions.sortBy] = paginationOptions.sortOrder === 'desc' ? -1 : 1;
    }
  
    const transactions = await this.transactionModel
      .find(query)
      .sort(sortOptions)
      .skip((paginationOptions.page - 1) * paginationOptions.limit)
      .limit(paginationOptions.limit)
      .lean();
  
    return {
      data: transactions,
      total,
      page: paginationOptions.page,
      limit: paginationOptions.limit,
      totalPages,
      hasMore: paginationOptions.page < totalPages
    };
  }
  
  async getTransactionStats(vendorId?: string) {
    const match: any = {};
    if (vendorId) {
      match.vendorId = vendorId;
    }
  
    return this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          successfulTransactions: {
            $sum: {
              $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0]
            }
          },
          disputedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'disputed'] }, '$amount', 0]
            }
          }
        }
      }
    ]);
  }


}
