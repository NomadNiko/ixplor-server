import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorSchemaClass, VendorSchemaDocument, VendorStatusEnum } from '../infrastructure/persistence/document/entities/vendor.schema';
import { UserSchemaClass } from '../../users/infrastructure/persistence/document/entities/user.schema';
import { RoleEnum } from '../../roles/roles.enum';
import { transformVendorResponse } from '../../utils/vendor.transform';

@Injectable()
export class VendorOwnerService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
  ) {}

  async findVendorsOwnedByUser(userId: string) {
    try {
      const vendors = await this.vendorModel
        .find({
          ownerIds: userId
        })
        .select('-__v -adminNotes')
        .lean()
        .exec();
  
      return {
        data: vendors.map((vendor) => ({
          ...transformVendorResponse(vendor),
          stripeConnectId: vendor.stripeConnectId,
          stripeAccountStatus: vendor.stripeAccountStatus,
          accountBalance: vendor.accountBalance,
          pendingBalance: vendor.pendingBalance
        })),
      };
    } catch (error) {
      console.error('Error finding vendors for user:', error);
      throw new InternalServerErrorException('Failed to fetch user vendors');
    }
  }

  async findAllVendorsForUser(userId: string) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const vendors = await this.vendorModel
        .find({
          ownerIds: userId,
        })
        .select('-__v')
        .lean()
        .exec();

      return {
        data: vendors.map((vendor) => ({
          ...transformVendorResponse(vendor),
          ownerIds: vendor.ownerIds,
          adminNotes: vendor.adminNotes,
        })),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error finding vendors for user (admin):', error);
      throw new InternalServerErrorException('Failed to fetch user vendors');
    }
  }

  async getVendorOwners(id: string) {
    try {
      const vendor = await this.vendorModel
        .findById(id)
        .select('ownerIds')
        .lean()
        .exec();

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return {
        data: vendor.ownerIds,
      };
    } catch (error) {
      console.error('Error getting vendor owners:', error);
      throw new InternalServerErrorException('Failed to get vendor owners');
    }
  }

  async updateOwnerRoles(ownerIds: string[]) {
    try {
      await this.userModel.updateMany(
        {
          _id: { $in: ownerIds },
          'role._id': RoleEnum.user,
        },
        {
          $set: {
            'role._id': RoleEnum.vendor,
          },
        },
      );
    } catch (error) {
      console.error('Error updating owner roles:', error);
      throw new InternalServerErrorException('Failed to update owner roles');
    }
  }

  async approveVendor(vendorId: string, userId: string) {
    const session = await this.vendorModel.db.startSession();
    
    try {
      let approvedVendor;
      await session.withTransaction(async () => {
        approvedVendor = await this.vendorModel
          .findByIdAndUpdate(
            vendorId,
            {
              vendorStatus: VendorStatusEnum.APPROVED,
              updatedAt: new Date(),
            },
            {
              new: true,
              session,
              runValidators: true,
            },
          )
          .lean();

        if (!approvedVendor) {
          throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
        }

        const user = await this.userModel.findById(userId).session(session);
        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }

        if (user.role?._id !== '1' && user.role?._id !== '3') {
          await this.userModel.findByIdAndUpdate(
            userId,
            {
              'role._id': '3',
              updatedAt: new Date(),
            },
            {
              session,
              runValidators: true,
            },
          );
        }

        if (!approvedVendor.ownerIds.includes(userId)) {
          await this.vendorModel.findByIdAndUpdate(
            vendorId,
            {
              $addToSet: { ownerIds: userId },
              updatedAt: new Date(),
            },
            { session },
          );
        }
      });

      return {
        data: transformVendorResponse(approvedVendor),
        message: 'Vendor successfully approved and user role updated',
      };
    } catch (error) {
      console.error('Error during vendor approval:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to approve vendor and update user role');
    } finally {
      await session.endSession();
    }
  }

  async isUserAssociatedWithVendor(userId: string, vendorId: string): Promise<boolean> {
    try {
      const vendor = await this.vendorModel
        .findOne({
          _id: vendorId,
          ownerIds: userId
        })
        .lean();
  
      return !!vendor;
    } catch (error) {
      console.error('Error checking user association with vendor:', error);
      throw new InternalServerErrorException('Failed to verify vendor association');
    }
  }

  async removeUserFromVendors(userId: string) {
    try {
      const vendors = await this.vendorModel.find({ ownerIds: userId });

      for (const vendor of vendors) {
        vendor.ownerIds = vendor.ownerIds.filter((id) => id !== userId);

        if (vendor.ownerIds.length === 0) {
          await this.vendorModel.findByIdAndDelete(vendor._id);
        } else {
          await vendor.save();
        }
      }
    } catch (error) {
      console.error('Error removing user from vendors:', error);
      throw new InternalServerErrorException('Failed to remove user from vendors');
    }
  }
}