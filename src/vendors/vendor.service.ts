import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { 
  VendorSchemaClass, 
  VendorStatusEnum,
  VendorType,
  VendorSchemaDocument
} from './infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>
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
      vendorType: type
    })
    .select('-__v')
    .lean()
    .exec();

    return {
      data: vendors.map(vendor => this.transformVendorResponse(vendor))
    };
  }

  async create(createVendorDto: CreateVendorDto) {
    const createdVendor = new this.vendorModel({
      ...createVendorDto,
      vendorStatus: VendorStatusEnum.SUBMITTED
    });
    
    const vendor = await createdVendor.save();
    return this.transformVendorResponse(vendor);
  }

  async update(id: string, updateData: any) {
    console.log('Updating vendor:', id, updateData); // Add logging

    const updatedVendor = await this.vendorModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();

    if (!updatedVendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return this.transformVendorResponse(updatedVendor);
  }

  async remove(id: string) {
    const vendor = await this.vendorModel.findByIdAndDelete(id);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
  }

  private transformVendorResponse(vendor: Record<string, any>) {
    return {
      _id: vendor._id.toString(),
      businessName: vendor.businessName,
      description: vendor.description,
      vendorType: vendor.vendorType,
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