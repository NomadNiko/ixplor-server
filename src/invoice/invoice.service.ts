import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { TransactionSchemaClass } from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { VendorService } from '../vendors/vendor.service';
import { InvoiceResponseDto } from './dto/invoice.dto';

type TransactionDocument = TransactionSchemaClass & Document;

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(TransactionSchemaClass.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly vendorService: VendorService,
  ) {}

  async findById(id: string): Promise<InvoiceResponseDto | null> {
    const transaction = await this.transactionModel.findById(id).lean();
    if (!transaction) {
      return null;
    }
    return this.transformToInvoice(transaction);
  }

  async findByCustomerId(customerId: string): Promise<InvoiceResponseDto[]> {
    const transactions = await this.transactionModel
      .find({ 
        customerId,
        type: 'payment',
        status: 'succeeded'
      })
      .sort({ createdAt: -1 })
      .lean();

    return transactions.map(t => this.transformToInvoice(t));
  }

  async findByVendorId(vendorId: string): Promise<InvoiceResponseDto[]> {
    const transactions = await this.transactionModel
      .find({ 
        vendorId,
        type: 'payment',
        status: 'succeeded'
      })
      .sort({ createdAt: -1 })
      .lean();

    return transactions.map(t => this.transformToInvoice(t));
  }

  async isUserAssociatedWithVendor(userId: string, vendorId: string): Promise<boolean> {
    return this.vendorService.isUserAssociatedWithVendor(userId, vendorId);
  }

  private transformToInvoice(transaction: any): InvoiceResponseDto {
    const items = transaction.metadata?.items ? JSON.parse(transaction.metadata.items) : [];
    
    return {
      _id: transaction._id.toString(),
      stripeCheckoutSessionId: transaction.stripeCheckoutSessionId,
      amount: transaction.amount / 100,
      currency: transaction.currency,
      vendorId: transaction.vendorId,
      customerId: transaction.customerId,
      productItemIds: transaction.productItemIds,
      status: transaction.status,
      type: transaction.type,
      description: transaction.description
    };
  }
}