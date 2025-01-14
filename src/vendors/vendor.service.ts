// src/vendors/vendor.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  VendorSchemaClass, 
  VendorStatusEnum,
  VendorType
} from './infrastructure/persistence/document/entities/vendor.schema';

interface VendorDocument extends VendorSchemaClass {
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>
  ) {}

  async findAllApproved() {
    const vendors = await this.vendorModel.find({ 
      vendorStatus: VendorStatusEnum.APPROVED 
    })
    .select('-__v')
    .lean<VendorDocument[]>()
    .exec();

    return {
      data: vendors.map(vendor => ({
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
        adminNotes: vendor.adminNotes,
        createdAt: vendor.createdAt.toISOString(),
        updatedAt: vendor.updatedAt.toISOString()
      }))
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
    .lean<VendorDocument[]>()
    .exec();

    return {
      data: vendors.map(vendor => ({
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
        adminNotes: vendor.adminNotes,
        createdAt: vendor.createdAt.toISOString(),
        updatedAt: vendor.updatedAt.toISOString()
      }))
    };
  }

  async findByType(type: VendorType) {
    const vendors = await this.vendorModel.find({
      vendorStatus: VendorStatusEnum.APPROVED,
      vendorType: type
    })
    .select('-__v')
    .lean<VendorDocument[]>()
    .exec();

    return {
      data: vendors.map(vendor => ({
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
        adminNotes: vendor.adminNotes,
        createdAt: vendor.createdAt.toISOString(),
        updatedAt: vendor.updatedAt.toISOString()
      }))
    };
  }
}