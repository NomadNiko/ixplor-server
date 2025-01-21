import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  VendorSchemaClass,
  VendorStatusEnum,
  VendorSchemaDocument,
  VendorType,
} from './infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ProductType } from '../products/infrastructure/persistence/document/entities/product.schema';
import { UserSchemaClass } from '../users/infrastructure/persistence/document/entities/user.schema';
import { RoleEnum } from '../roles/roles.enum';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
  ) {}

  async findAllVendors() {
    const vendors = await this.vendorModel.find().select('-__v').lean().exec();
    return {
      data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
    };
  }
  // restricted to user
  async findVendorsOwnedByUser(userId: string) {
    try {
      // Find user first to verify they exist
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Get vendors where user is in ownerIds array
      const vendors = await this.vendorModel
        .find({
          ownerIds: userId,
          vendorStatus: VendorStatusEnum.APPROVED, // Only return approved vendors
        })
        .select('-__v -ownerIds -adminNotes') // Exclude sensitive fields
        .lean()
        .exec();

      return {
        data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error finding vendors for user:', error);
      throw new InternalServerErrorException('Failed to fetch user vendors');
    }
  }
  // for admins
  async findAllVendorsForUser(userId: string) {
    try {
      // Find user first to verify they exist
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Get all vendors where user is in ownerIds array, regardless of status
      const vendors = await this.vendorModel
        .find({
          ownerIds: userId,
        })
        .select('-__v') // We keep more fields for admin view
        .lean()
        .exec();

      return {
        data: vendors.map((vendor) => ({
          ...this.transformVendorResponse(vendor),
          ownerIds: vendor.ownerIds, // Include ownership data for admin view
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

  async findAllApproved() {
    const vendors = await this.vendorModel
      .find({
        vendorStatus: VendorStatusEnum.APPROVED,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
    };
  }

  async findNearby(lat: number, lng: number, radius: number = 10) {
    const radiusInMeters = radius * 1609.34; // Convert miles to meters

    const vendors = await this.vendorModel
      .find({
        vendorStatus: VendorStatusEnum.APPROVED,
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
      data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
    };
  }

  async findByType(type: VendorType) {
    const vendors = await this.vendorModel
      .find({
        vendorStatus: VendorStatusEnum.APPROVED,
        vendorTypes: type,
      })
      .select('-__v')
      .lean()
      .exec();
    return {
      data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
    };
  }

  async create(createVendorDto: CreateVendorDto, userId: string) {
    const createdVendor = new this.vendorModel({
      ...createVendorDto,
      vendorStatus: VendorStatusEnum.SUBMITTED,
      ownerIds: [userId],
    });

    const vendor = await createdVendor.save();

    // Update the user's vendorProfileIds
    await this.userModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: { vendorProfileIds: vendor._id },
      },
      { new: true },
    );

    return {
      data: this.transformVendorResponse(vendor),
      message: 'Vendor created successfully',
    };
  }

  private async updateOwnerRoles(ownerIds: string[]) {
    try {
      // Update all owners who are currently "user" role to "vendor" role
      await this.userModel.updateMany(
        {
          _id: { $in: ownerIds },
          'role._id': RoleEnum.user, // Only update if they are currently a user
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
    try {
      // Start a session for transactional operations
      const session = await this.vendorModel.db.startSession();
      let approvedVendor;

      await session.withTransaction(async () => {
        // Update vendor status to APPROVED
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

        // Get user and check if they need role update
        const user = await this.userModel.findById(userId).session(session);
        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Only update role if user is not an admin and not already a vendor
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
        // Ensure user is in vendor's ownerIds if not already
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

      await session.endSession();

      return {
        data: this.transformVendorResponse(approvedVendor),
        message: 'Vendor successfully approved and user role updated',
      };
    } catch (error) {
      console.error('Error during vendor approval:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to approve vendor and update user role',
      );
    }
  }

  async update(id: string, updateData: UpdateVendorDto) {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    // If status is being changed to APPROVED, update owner roles
    if (
      updateData.vendorStatus === VendorStatusEnum.APPROVED &&
      vendor.vendorStatus !== VendorStatusEnum.APPROVED
    ) {
      await this.updateOwnerRoles(vendor.ownerIds);
    }

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
      data: this.transformVendorResponse(updatedVendor),
      message: 'Vendor updated successfully',
    };
  }

  async remove(id: string) {
    const vendor = await this.vendorModel.findById(id);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    try {
      // Start a session for the transaction
      const session = await this.vendorModel.db.startSession();

      await session.withTransaction(async () => {
        // Delete all products associated with this vendor
        const ProductModel = this.vendorModel.db.model('ProductSchemaClass');
        await ProductModel.deleteMany({ vendorId: id }).session(session);

        // Remove vendorProfileId from all associated users
        await this.userModel
          .updateMany(
            { vendorProfileIds: id },
            { $pull: { vendorProfileIds: id } },
          )
          .session(session);

        // Delete the vendor
        await this.vendorModel.findByIdAndDelete(id).session(session);
      });

      await session.endSession();

      return {
        message: 'Vendor and associated data deleted successfully',
      };
    } catch (error) {
      console.error('Error during vendor deletion:', error);
      throw new InternalServerErrorException(
        'Failed to delete vendor and associated data',
      );
    }
  }

  async removeUserFromVendors(userId: string) {
    try {
      const vendors = await this.vendorModel.find({ ownerIds: userId });

      for (const vendor of vendors) {
        // Remove the user from ownerIds
        vendor.ownerIds = vendor.ownerIds.filter((id) => id !== userId);

        if (vendor.ownerIds.length === 0) {
          // If no owners left, delete the vendor and its products
          await this.remove(vendor._id.toString());
        } else {
          // Otherwise just update the vendor
          await vendor.save();
        }
      }
    } catch (error) {
      console.error('Error removing user from vendors:', error);
      throw new InternalServerErrorException(
        'Failed to remove user from vendors',
      );
    }
  }

  private async getProductTypes(vendorId: string): Promise<ProductType[]> {
    const ProductModel = this.vendorModel.db.model('ProductSchemaClass');

    const products = await ProductModel.find({
      vendorId: vendorId,
      productStatus: 'PUBLISHED',
    })
      .lean()
      .exec();

    return Array.from(new Set(products.map((product) => product.productType)));
  }

  async updateVendorTypes(vendorId: string, vendorTypes?: VendorType[]) {
    try {
      // If vendorTypes not provided, fetch from products
      if (!vendorTypes) {
        vendorTypes = await this.getProductTypes(vendorId);
      }

      const updatedVendor = await this.vendorModel
        .findByIdAndUpdate(
          vendorId,
          {
            vendorTypes: Array.from(new Set(vendorTypes)),
            updatedAt: new Date(),
          },
          { new: true },
        )
        .lean();

      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }

      return this.transformVendorResponse(updatedVendor);
    } catch (error) {
      console.error(
        `Error updating vendor types for vendor ${vendorId}:`,
        error,
      );
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
        coordinates: [vendor.longitude, vendor.latitude] as [number, number],
      },
      logoUrl: vendor.logoUrl,
      vendorStatus: vendor.vendorStatus,
      actionNeeded: vendor.actionNeeded,
      adminNotes: vendor.adminNotes,
      createdAt: vendor.createdAt?.toISOString(),
      updatedAt: vendor.updatedAt?.toISOString(),
    };
  }
}
