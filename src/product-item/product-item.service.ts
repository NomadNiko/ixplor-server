import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
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
    private readonly templateService: ProductTemplateService,
  ) {}

  async findAllItems() {
    const items = await this.itemModel.find().select('-__v').lean().exec();
    return {
      data: items.map((item) => this.transformItemResponse(item)),
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
      data: items.map((item) => this.transformItemResponse(item)),
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
      data: items.map((item) => this.transformItemResponse(item)),
    };
  }

  async findById(id: string) {
    const item = await this.itemModel.findById(id).select('-__v').lean().exec();
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
      data: items.map((item) => this.transformItemResponse(item)),
    };
  }

  async validateAvailability(
    productItemId: string,
    requestedQuantity: number,
  ): Promise<boolean> {
    const session = await this.itemModel.startSession();
    session.startTransaction();

    try {
      // Use findOne with session to get current state
      const item = await this.itemModel
        .findOne({
          _id: productItemId,
          itemStatus: ProductItemStatusEnum.PUBLISHED,
          quantityAvailable: { $gte: requestedQuantity },
        })
        .session(session);

      await session.commitTransaction();
      return !!item;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error validating product item availability:', error);
      throw new InternalServerErrorException('Failed to validate availability');
    } finally {
      await session.endSession();
    }
  }

  

  async updateQuantityForPurchase(
    productItemId: string,
    quantityToDeduct: number,
  ): Promise<void> {
    const session = await this.itemModel.startSession();
    session.startTransaction();

    try {
      const item = await this.itemModel
        .findById(productItemId)
        .session(session);

      if (!item) {
        throw new NotFoundException('Product item not found');
      }

      if (item.itemStatus !== ProductItemStatusEnum.PUBLISHED) {
        throw new BadRequestException(
          'Product item is not available for purchase',
        );
      }

      if (item.quantityAvailable < quantityToDeduct) {
        throw new BadRequestException('Insufficient quantity available');
      }

      const updatedItem = await this.itemModel.findByIdAndUpdate(
        productItemId,
        {
          $inc: { quantityAvailable: -quantityToDeduct },
          $set: { updatedAt: new Date() },
        },
        { new: true, session },
      );

      if (!updatedItem) {
        throw new NotFoundException('Failed to update product item quantity');
      }

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async validateAndReserveQuantity(
    items: Array<{ productItemId: string; quantity: number }>,
  ): Promise<boolean> {
    const session = await this.itemModel.startSession();
    session.startTransaction();

    try {
      for (const item of items) {
        const productItem = await this.itemModel
          .findOne({
            _id: item.productItemId,
            itemStatus: ProductItemStatusEnum.PUBLISHED,
            quantityAvailable: { $gte: item.quantity },
          })
          .session(session);

        if (!productItem) {
          await session.abortTransaction();
          return false;
        }
      }

      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error validating quantities:', error);
      throw new InternalServerErrorException('Failed to validate quantities');
    } finally {
      await session.endSession();
    }
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
        longitude:
          createItemDto.longitude || template.data.location?.coordinates[0],
        latitude:
          createItemDto.latitude || template.data.location?.coordinates[1],

        templateName: template.data.templateName,
        description: template.data.description,
        productType: template.data.productType,
        requirements: [...template.data.requirements],
        waiver: template.data.waiver,
        imageURL: template.data.imageURL,
        additionalInfo: template.data.additionalInfo,
        itemStatus: ProductItemStatusEnum.DRAFT,
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
          { new: true, runValidators: true },
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
      data: items.map((item) => this.transformItemResponse(item)),
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

  async checkAvailabilityForDate(productItemId: string, date: Date): Promise<boolean> {
    try {
      const item = await this.itemModel.findOne({
        _id: productItemId,
        productDate: date,
        itemStatus: ProductItemStatusEnum.PUBLISHED,
        quantityAvailable: { $gt: 0 }
      });
      
      return !!item;
    } catch (error) {
      console.error('Error checking product item availability:', error);
      throw new InternalServerErrorException('Failed to check availability');
    }
  }

  async checkAvailabilityForDateRange(
    templateId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<{ date: string; available: boolean; quantityAvailable: number }[]> {
    try {
      const items = await this.itemModel.find({
        templateId,
        productDate: {
          $gte: startDate,
          $lte: endDate
        },
        itemStatus: ProductItemStatusEnum.PUBLISHED
      })
      .select('productDate quantityAvailable')
      .lean();

      // Create a map of all dates in range
      const dateMap = new Map();
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dateMap.set(
          currentDate.toISOString().split('T')[0], 
          { available: false, quantityAvailable: 0 }
        );
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Update map with actual availability data
      items.forEach(item => {
        const dateKey = new Date(item.productDate).toISOString().split('T')[0];
        dateMap.set(dateKey, {
          available: item.quantityAvailable > 0,
          quantityAvailable: item.quantityAvailable
        });
      });

      // Convert map to array
      return Array.from(dateMap.entries()).map(([date, data]) => ({
        date,
        available: data.available,
        quantityAvailable: data.quantityAvailable
      }));
    } catch (error) {
      console.error('Error checking date range availability:', error);
      throw new InternalServerErrorException('Failed to check date range availability');
    }
  }

  async checkBulkAvailability(
    items: Array<{ productItemId: string; quantity: number; date?: Date }>
  ): Promise<{ 
    available: boolean; 
    unavailableItems: Array<{ productItemId: string; reason: string }> 
  }> {
    try {
      // Explicitly type the array
      const unavailableItems: Array<{ productItemId: string; reason: string }> = [];
  
      for (const item of items) {
        const productItem = await this.itemModel.findOne({
          _id: item.productItemId,
          itemStatus: ProductItemStatusEnum.PUBLISHED,
          ...(item.date && { productDate: item.date }),
          quantityAvailable: { $gte: item.quantity }
        });
  
        if (!productItem) {
          const existingItem = await this.itemModel.findById(item.productItemId);
          let reason = 'Item not found';
          
          if (existingItem) {
            if (existingItem.itemStatus !== ProductItemStatusEnum.PUBLISHED) {
              reason = 'Item not available for booking';
            } else if (existingItem.quantityAvailable < item.quantity) {
              reason = `Insufficient quantity (requested: ${item.quantity}, available: ${existingItem.quantityAvailable})`;
            }
          }
  
          unavailableItems.push({
            productItemId: item.productItemId,
            reason
          });
        }
      }
  
      return {
        available: unavailableItems.length === 0,
        unavailableItems
      };
    } catch (error) {
      console.error('Error checking bulk availability:', error);
      throw new InternalServerErrorException('Failed to check bulk availability');
    }
  }

  async getAvailabilityCalendar(
    templateId: string,
    month: number,
    year: number
  ): Promise<{
    date: string;
    timeSlots: Array<{
      startTime: string;
      available: boolean;
      quantityAvailable: number;
    }>;
  }[]> {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const items = await this.itemModel.find({
        templateId,
        productDate: {
          $gte: startDate,
          $lte: endDate
        },
        itemStatus: ProductItemStatusEnum.PUBLISHED
      })
      .select('productDate startTime quantityAvailable')
      .lean();

      // Create a map for each day of the month
      const calendarMap = new Map();
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        calendarMap.set(
          currentDate.toISOString().split('T')[0],
          { timeSlots: [] }
        );
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Populate the calendar with actual availability data
      items.forEach(item => {
        const dateKey = new Date(item.productDate).toISOString().split('T')[0];
        const dateData = calendarMap.get(dateKey);
        
        if (dateData) {
          dateData.timeSlots.push({
            startTime: item.startTime,
            available: item.quantityAvailable > 0,
            quantityAvailable: item.quantityAvailable
          });
        }
      });

      // Convert map to array and sort time slots
      return Array.from(calendarMap.entries()).map(([date, data]) => ({
        date,
        timeSlots: data.timeSlots.sort((a, b) => 
          a.startTime.localeCompare(b.startTime)
        )
      }));
    } catch (error) {
      console.error('Error generating availability calendar:', error);
      throw new InternalServerErrorException('Failed to generate availability calendar');
    }
  }

}
