import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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
    try {
      const transaction = new this.transactionModel({
        ...transactionData,
        productItemIds: Array.isArray(transactionData.productItemIds) 
          ? transactionData.productItemIds 
          : [transactionData.productItemIds]
      });
      return transaction.save();
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new InternalServerErrorException('Failed to create transaction');
    }
  }

  async findById(id: string) {
    const transaction = await this.transactionModel
      .findById(id)
      .select('-__v')
      .lean();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return {
      data: this.transformTransaction(transaction)
    };
  }

  async findByProductItemIds(productItemIds: string[]) {
    try {
      const transactions = await this.transactionModel
        .find({
          productItemIds: { $in: productItemIds },
          type: TransactionType.PAYMENT,
          status: TransactionStatus.SUCCEEDED
        })
        .sort({ createdAt: -1 })
        .lean();

      return {
        data: transactions.map(transaction => this.transformTransaction(transaction))
      };
    } catch (error) {
      console.error('Error finding transactions by product item ids:', error);
      throw new InternalServerErrorException('Failed to fetch transactions');
    }
  }

  async findByCheckoutSessionId(checkoutSessionId: string) {
    const transaction = await this.transactionModel.findOne({ 
      stripeCheckoutSessionId: checkoutSessionId 
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async updateTransactionStatus(
    checkoutSessionId: string, 
    status: TransactionStatus,
    additionalData: Partial<TransactionSchemaClass> = {}
  ) {
    const transaction = await this.transactionModel.findOneAndUpdate(
      { stripeCheckoutSessionId: checkoutSessionId },
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

  
  private transformTransaction(transaction: Record<string, any>) {
    return {
      _id: transaction._id.toString(),
      stripeCheckoutSessionId: transaction.stripeCheckoutSessionId,
      amount: transaction.amount,
      currency: transaction.currency,
      vendorId: transaction.vendorId,
      customerId: transaction.customerId,
      productItemIds: transaction.productItemIds,
      status: transaction.status,
      type: transaction.type,
      description: transaction.description,
      metadata: transaction.metadata,
      paymentMethodDetails: transaction.paymentMethodDetails,
      receiptEmail: transaction.receiptEmail,
      refundId: transaction.refundId,
      refundAmount: transaction.refundAmount,
      refundReason: transaction.refundReason,
      disputeId: transaction.disputeId,
      disputeStatus: transaction.disputeStatus,
      disputeAmount: transaction.disputeAmount,
      error: transaction.error,
      createdAt: transaction.createdAt?.toISOString(),
      updatedAt: transaction.updatedAt?.toISOString()
    };
  }

  async findByVendorId(vendorId: string) {
    try {
      const transactions = await this.transactionModel
        .find({ vendorId })
        .sort({ createdAt: -1 });
  
      return {
        data: transactions.map(transaction => this.transformTransaction(transaction)),
      };
    } catch (error) {
      console.error('Error finding transactions for vendor:', error);
      throw new InternalServerErrorException('Failed to fetch vendor transactions');
    }
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
