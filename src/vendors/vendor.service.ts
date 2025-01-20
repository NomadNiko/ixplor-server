import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  VendorSchemaClass, 
  VendorStatusEnum,
  VendorSchemaDocument,
  VendorType
} from './infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ProductType } from 'src/products/infrastructure/persistence/document/entities/product.schema';
import { UserSchemaClass } from '../users/infrastructure/persistence/document/entities/user.schema';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>
  ) {}

  async findAllVendors() {
    const vendors = await this.vendorModel.find()
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map(vendor => this.transformVendorResponse(vendor))
    };
  }

  async findAllApproved() {
    const vendors = await this.vendorModel.find({ 
      vendorStatus: VendorStatusEnum.APPROVED 
    })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map(vendor => this.transformVendorResponse(vendor))
    };
  }

  async findNearby(lat: number, lng: number, radius: number = 10) {
    const radiusInMeters = radius * 1609.34; // Convert miles to meters
    
    const vendors = await this.vendorModel.find({
      vendorStatus: VendorStatusEnum.APPROVED,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: radiusInMeters
        }
      }
    })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map(vendor => this.transformVendorResponse(vendor))
    };
  }

  async findByType(type: VendorType) {
    const vendors = await this.vendorModel.find({
      vendorStatus: VendorStatusEnum.APPROVED,
      vendorTypes: type
    })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map(vendor => this.transformVendorResponse(vendor))
    };
  }

  async create(createVendorDto: CreateVendorDto, userId: string) {
    const createdVendor = new this.vendorModel({
      ...createVendorDto,
      vendorStatus: VendorStatusEnum.SUBMITTED,
      ownerIds: [userId]
    });
    
    const vendor = await createdVendor.save();

     // Update the user's vendorProfileIds
     await this.userModel.findByIdAndUpdate(
      userId,
      { 
        $addToSet: { vendorProfileIds: vendor._id } 
      },
      { new: true }
    );


    return {
      data: this.transformVendorResponse(vendor),
      message: 'Vendor created successfully'
    };
  }

  async update(id: string, updateData: UpdateVendorDto) {
    const updatedVendor = await this.vendorModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();

    if (!updatedVendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return {
      data: this.transformVendorResponse(updatedVendor),
      message: 'Vendor updated successfully'
    };
  }

  async remove(id: string) {
    const vendor = await this.vendorModel.findByIdAndDelete(id);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
    return {
      message: 'Vendor deleted successfully'
    };
  }

  private async getProductTypes(vendorId: string): Promise<ProductType[]> {
    const ProductModel = this.vendorModel.db.model('ProductSchemaClass');
    
    const products = await ProductModel.find({ 
      vendorId: vendorId,
      productStatus: 'PUBLISHED'
    }).lean().exec();
  
    return Array.from(new Set(products.map(product => product.productType)));
  }
  
  async updateVendorTypes(vendorId: string, vendorTypes?: VendorType[]) {
    try {
      // If vendorTypes not provided, fetch from products
      if (!vendorTypes) {
        vendorTypes = await this.getProductTypes(vendorId);
      }
  
      const updatedVendor = await this.vendorModel.findByIdAndUpdate(
        vendorId,
        { 
          vendorTypes: Array.from(new Set(vendorTypes)), 
          updatedAt: new Date() 
        },
        { new: true }
      ).lean();
  
      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }
  
      return this.transformVendorResponse(updatedVendor);
    } catch (error) {
      console.error(`Error updating vendor types for vendor ${vendorId}:`, error);
      throw error;
    }
  }

  private transformVendorResponse(vendor: Record<string, any>) {
    return {
      _id: vendor._id.toString(),
      businessName: vendor.businessName,
      description: vendor.description,
      vendorTypes: vendor.vendorTypes || [],
      website: vendor.website,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address, 
      city: vendor.city,
      state: vendor.state,
      postalCode: vendor.postalCode,
      location: {
        type: 'Point' as const,
        coordinates: [vendor.longitude, vendor.latitude] as [number, number]
      },
      logoUrl: vendor.logoUrl,
      vendorStatus: vendor.vendorStatus,
      actionNeeded: vendor.actionNeeded,
      adminNotes: vendor.adminNotes,
      createdAt: vendor.createdAt?.toISOString(),
      updatedAt: vendor.updatedAt?.toISOString()
    };
  }
}