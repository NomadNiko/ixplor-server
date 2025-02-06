import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorSchemaClass, VendorSchemaDocument } from '../infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { transformVendorResponse } from '../../utils/vendor.transform';

@Injectable()
export class VendorCrudService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
  ) {}

  async findAll() {
    const vendors = await this.vendorModel
      .find()
      .select('-__v')
      .lean()
      .exec();

    return {
      data: vendors.map((vendor) => transformVendorResponse(vendor)),
    };
  }

  async findAllApproved() {
    const vendors = await this.vendorModel
      .find({
        vendorStatus: 'APPROVED',
      })
      .select('-__v')
      .lean()
      .exec();

    return {
      data: vendors.map((vendor) => transformVendorResponse(vendor)),
    };
  }

  async findById(id: string) {
    const vendor = await this.vendorModel
      .findById(id)
      .lean()
      .exec();

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    return {
      data: transformVendorResponse(vendor),
    };
  }

  async create(createVendorDto: CreateVendorDto, userId: string) {
    try {
      const createdVendor = new this.vendorModel({
        ...createVendorDto,
        vendorStatus: 'SUBMITTED',
        ownerIds: [userId],
      });
      
      const savedVendor = await createdVendor.save();
      // Convert to plain object before transformation
      const plainVendor = savedVendor.toObject();
      
      return {
        data: transformVendorResponse(plainVendor),
        message: 'Vendor created successfully',
      };
    } catch (error) {
      console.error('Error creating vendor:', error);
      throw new InternalServerErrorException('Failed to create vendor');
    }
  }

  async update(id: string, updateData: UpdateVendorDto) {
    try {
      const updatedVendor = await this.vendorModel
        .findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();

      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return {
        data: transformVendorResponse(updatedVendor),
        message: 'Vendor updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating vendor:', error);
      throw new InternalServerErrorException('Failed to update vendor');
    }
  }

  async remove(id: string) {
    try {
      const vendor = await this.vendorModel.findById(id);
      
      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      await this.vendorModel.findByIdAndDelete(id);

      return {
        message: 'Vendor deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error deleting vendor:', error);
      throw new InternalServerErrorException('Failed to delete vendor');
    }
  }
}