import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductItemSchemaClass,
  ProductItemSchemaDocument,
  ProductItemStatusEnum,
} from './infrastructure/persistence/document/entities/product-item.schema';
import { ProductTemplateService } from '../product-template/product-template.service';

@Injectable()
export class ProductItemService {
  constructor(
    @InjectModel(ProductItemSchemaClass.name)
    private readonly itemModel: Model<ProductItemSchemaDocument>,
    private readonly templateService: ProductTemplateService
  ) {}

  async findAllItems() {
    const items = await this.itemModel
      .find()
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map(item => this.transformItemResponse(item)),
    };
  }

  async findByTemplate(templateId: string) {
    const items = await this.itemModel
      .find({
        templateId: templateId,
        itemStatus: ProductItemStatusEnum.PUBLISHED,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map(item => this.transformItemResponse(item)),
    };
  }

  async findByVendor(vendorId: string) {
    const items = await this.itemModel
      .find({
        vendorId: vendorId,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map(item => this.transformItemResponse(item)),
    };
  }

  async findById(id: string) {
    const item = await this.itemModel
      .findById(id)
      .select('-__v')
      .lean()
      .exec();
    if (!item) {
      throw new NotFoundException(`Product item with ID ${id} not found`);
    }
    return {
      data: this.transformItemResponse(item),
    };
  }

  async findAvailableItems(templateId: string, date: Date) {
    const items = await this.itemModel
      .find({
        templateId: templateId,
        productDate: date,
        itemStatus: ProductItemStatusEnum.PUBLISHED,
        quantityAvailable: { $gt: 0 },
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: items.map(item => this.transformItemResponse(item)),
    };
  }

  async createFromTemplate(templateId: string, createItemDto: any) {
    try {
      const template = await this.templateService.findById(templateId);
      if (!template) {
        throw new NotFoundException(`Template with ID ${templateId} not found`);
      }

      const itemData = {
        templateId,
        vendorId: template.data.vendorId,
        productDate: createItemDto.productDate,
        startTime: createItemDto.startTime,
        quantityAvailable: createItemDto.quantityAvailable,
        instructorName: createItemDto.instructorName,
        tourGuide: createItemDto.tourGuide,
        equipmentSize: createItemDto.equipmentSize,
        notes: createItemDto.notes,
        duration: createItemDto.duration || template.data.defaultDuration,
        price: createItemDto.price || template.data.basePrice,
        longitude: createItemDto.longitude || template.data.location?.coordinates[0],
        latitude: createItemDto.latitude || template.data.location?.coordinates[1],
        
        templateName: template.data.templateName,
        description: template.data.description,
        productType: template.data.productType,
        requirements: [...template.data.requirements],
        waiver: template.data.waiver,
        imageURL: template.data.imageURL,
        additionalInfo: template.data.additionalInfo,
        itemStatus: ProductItemStatusEnum.DRAFT
      };

      const createdItem = new this.itemModel(itemData);
      const item = await createdItem.save();
      
      return {
        data: this.transformItemResponse(item),
        message: 'Product item created successfully',
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async update(id: string, updateItemDto: any) {
    try {
      const updatedItem = await this.itemModel
        .findByIdAndUpdate(
          id,
          { $set: updateItemDto },
          { new: true, runValidators: true }
        )
        .exec();
      
      if (!updatedItem) {
        throw new NotFoundException(`Product item with ID ${id} not found`);
      }
      
      return {
        data: this.transformItemResponse(updatedItem),
        message: 'Product item updated successfully',
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: ProductItemStatusEnum) {
    const item = await this.itemModel.findById(id).exec();
    
    if (!item) {
      throw new NotFoundException(`Product item with ID ${id} not found`);
    }
    
    item.itemStatus = status;
    item.updatedAt = new Date();
    
    const updatedItem = await item.save();
    
    return {
      data: this.transformItemResponse(updatedItem),
      message: 'Product item status updated successfully',
    };
  }

  async updateQuantity(id: string, quantityChange: number) {
    const session = await this.itemModel.startSession();
    session.startTransaction();
  
    try {
      const item = await this.itemModel.findById(id).session(session);
      
      if (!item) {
        throw new NotFoundException(`Product item with ID ${id} not found`);
      }
  
      const newQuantity = item.quantityAvailable + quantityChange;
      
      if (newQuantity < 0) {
        throw new BadRequestException('Insufficient quantity available');
      }
  
      item.quantityAvailable = newQuantity;
      await item.save({ session });
      await session.commitTransaction();
  
      return {
        data: this.transformItemResponse(item),
        message: 'Product item quantity updated successfully',
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async remove(id: string) {
    const item = await this.itemModel.findById(id);
    
    if (!item) {
      throw new NotFoundException(`Product item with ID ${id} not found`);
    }
    
    await this.itemModel.findByIdAndDelete(id);
    
    return {
      message: 'Product item deleted successfully',
    };
  }

  async findNearby(lat: number, lng: number, radius: number = 10) {
    const radiusInMeters = radius * 1609.34; // Convert miles to meters
    
    const items = await this.itemModel
      .find({
        itemStatus: ProductItemStatusEnum.PUBLISHED,
        quantityAvailable: { $gt: 0 },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: radiusInMeters,
          },
        },
      })
      .select('-__v')
      .lean()
      .exec();

    return {
      data: items.map(item => this.transformItemResponse(item)),
    };
  }

  private transformItemResponse(item: Record<string, any>) {
    return {
      _id: item._id.toString(),
      templateId: item.templateId,
      vendorId: item.vendorId,
      productDate: item.productDate?.toISOString(),
      startTime: item.startTime,
      duration: item.duration,
      price: item.price,
      quantityAvailable: item.quantityAvailable,
      location: {
        type: 'Point' as const,
        coordinates: [item.longitude, item.latitude] as [number, number],
      },
      itemStatus: item.itemStatus,
      
      templateName: item.templateName,
      description: item.description,
      productType: item.productType,
      requirements: item.requirements,
      waiver: item.waiver,
      imageURL: item.imageURL,
      additionalInfo: item.additionalInfo,
      
      instructorName: item.instructorName,
      tourGuide: item.tourGuide,
      equipmentSize: item.equipmentSize,
      notes: item.notes,
      
      createdAt: item.createdAt?.toISOString(),
      updatedAt: item.updatedAt?.toISOString(),
    };
  }
}