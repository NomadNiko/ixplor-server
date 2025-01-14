import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorSchemaClass, VendorStatusEnum } from './infrastructure/persistence/document/entities/vendor.schema';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaClass>
  ) {}

  async findAllApproved() {
    return this.vendorModel.find({ 
      vendorStatus: VendorStatusEnum.APPROVED 
    }).exec();
  }

  async findNearby(lat: number, lng: number, radius: number = 10) {
    // Convert radius from miles to meters (1 mile = 1609.34 meters)
    const radiusInMeters = radius * 1609.34;

    return this.vendorModel.find({
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
    }).exec();
  }

  async findByType(type: string) {
    return this.vendorModel.find({
      vendorStatus: VendorStatusEnum.APPROVED,
      vendorType: type
    }).exec();
  }
}
