import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorSchemaClass, VendorSchemaDocument } from '../infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { transformVendorResponse } from '../../utils/vendor.transform';
import { UserSchemaClass } from 'src/users/infrastructure/persistence/document/entities/user.schema';

@Injectable()
export class VendorCrudService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
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
    const session = await this.vendorModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        // Create vendor within the session
        const createdVendor = new this.vendorModel({
          ...createVendorDto,
          vendorStatus: 'SUBMITTED',
          ownerIds: [userId],
        });
        const savedVendor = await createdVendor.save({ session });
        const plainVendor = savedVendor.toObject();
  
        // Find and update user
        const user = await this.userModel.findById(userId).session(session);
        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }
  
        // Update role if needed
        if (user.role?._id !== '1' && user.role?._id !== '3') {
          await this.userModel.findByIdAndUpdate(
            userId,
            {
              'role._id': '4',
              updatedAt: new Date(),
              // Add the new vendor ID to the user's vendorProfileIds
              $addToSet: { vendorProfileIds: savedVendor._id }
            },
            {
              session,
              runValidators: true,
            },
          );
        } else {
          // Just update vendorProfileIds if role doesn't need to change
          await this.userModel.findByIdAndUpdate(
            userId,
            {
              $addToSet: { vendorProfileIds: savedVendor._id },
              updatedAt: new Date()
            },
            {
              session,
              runValidators: true,
            }
          );
        }
  
        result = {
          data: transformVendorResponse(plainVendor),
          message: 'Vendor created successfully',
        };
      });
  
      return result;
    } catch (error) {
      console.error('Error creating vendor:', error);
      throw new InternalServerErrorException('Failed to create vendor');
    } finally {
      await session.endSession();
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