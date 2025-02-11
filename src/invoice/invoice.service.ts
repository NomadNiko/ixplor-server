import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TransactionSchemaClass } from '../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { UserSchemaClass } from '../users/infrastructure/persistence/document/entities/user.schema';
import { VendorSchemaClass } from '../vendors/infrastructure/persistence/document/entities/vendor.schema';
import { ProductItemSchemaClass } from '../product-item/infrastructure/persistence/document/entities/product-item.schema';
import { VendorService } from '../vendors/vendor.service';
import { InvoiceResponseDto } from './dto/invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectModel(TransactionSchemaClass.name)
    private readonly transactionModel: Model<TransactionSchemaClass>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>,
    @InjectModel(ProductItemSchemaClass.name)
    private readonly productItemModel: Model<ProductItemSchemaClass>,
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

    return Promise.all(transactions.map(t => this.transformToInvoice(t)));
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

    return Promise.all(transactions.map(t => this.transformToInvoice(t)));
  }

  async isUserAssociatedWithVendor(userId: string, vendorId: string): Promise<boolean> {
    return this.vendorService.isUserAssociatedWithVendor(userId, vendorId);
  }

  private async transformToInvoice(transaction: any): Promise<InvoiceResponseDto> {
    // Get customer details
    const customer = await this.userModel.findById(transaction.customerId).lean();
    const customerName = customer 
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : 'Unknown Customer';

    // Get vendor details
    const vendor = await this.vendorModel.findById(transaction.vendorId).lean();
    const vendorName = vendor?.businessName || 'Unknown Vendor';

    // Parse items from metadata
    const items = transaction.metadata?.items ? JSON.parse(transaction.metadata.items) : [];

    // Get product details for each item
    const productItemIds = transaction.productItemIds || [];
    const products = await this.productItemModel.find({
      _id: { $in: productItemIds }
    }).lean();

    // Create the response
    return {
      _id: transaction._id.toString(),
      stripeCheckoutSessionId: transaction.stripeCheckoutSessionId,
      amount: transaction.amount / 100,
      currency: transaction.currency,
      vendorId: transaction.vendorId,
      vendorName,
      customerId: transaction.customerId,
      customerName,
      productItemIds,
      status: transaction.status,
      type: transaction.type,
      description: transaction.description
    };
  }
}