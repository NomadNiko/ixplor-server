import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  VendorSchemaClass,
  VendorStatusEnum,
  VendorSchemaDocument,
  VendorType,
  StripeRequirement,
  StripeRequirementErrorEnum,
} from './infrastructure/persistence/document/entities/vendor.schema';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ProductType } from '../products/infrastructure/persistence/document/entities/product.schema';
import { UserSchemaClass } from '../users/infrastructure/persistence/document/entities/user.schema';
import { RoleEnum } from '../roles/roles.enum';
import { VendorPaginationParams } from './types/pagination-params.type';
import { PaginatedVendorResponse, SortOrder, VendorSortField } from './dto/vendor-pagination.dto';
import { calculateDistance } from './types/location-utils';
import Stripe from 'stripe';
import { TransactionStatus, TransactionType } from 'src/transactions/infrastructure/persistence/document/entities/transaction.schema';
import { ConfigService } from '@nestjs/config';
import { TransactionSchemaClass } from '../transactions/infrastructure/persistence/document/entities/transaction.schema';

@Injectable()
export class VendorService {
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
    @InjectModel(TransactionSchemaClass.name)
    private readonly transactionModel: Model<TransactionSchemaClass>,
    private readonly configService: ConfigService,
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
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
  
      const vendors = await this.vendorModel
        .find({
          ownerIds: userId,
          vendorStatus: VendorStatusEnum.APPROVED,
        })
        .select('-__v -adminNotes') // We exclude sensitive fields but keep Stripe info
        .lean()
        .exec();
  
      return {
        data: vendors.map((vendor) => ({
          ...this.transformVendorResponse(vendor),
          stripeConnectId: vendor.stripeConnectId,
          stripeAccountStatus: vendor.stripeAccountStatus,
          accountBalance: vendor.accountBalance,
          pendingBalance: vendor.pendingBalance
        })),
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

  async updateStripeConnectId(vendorId: string, stripeConnectId: string) {
    try {
      const updatedVendor = await this.vendorModel.findByIdAndUpdate(
        vendorId,
        { 
          stripeConnectId: stripeConnectId,
          updatedAt: new Date()
        },
        { new: true }
      ).lean();
  
      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }
  
      return {
        data: this.transformVendorResponse(updatedVendor),
        message: 'Stripe Connect ID updated successfully'
      };
    } catch (error) {
      console.error('Error updating Stripe Connect ID:', error);
      throw new InternalServerErrorException('Failed to update Stripe Connect ID');
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
      stripeConnectId: vendor.stripeConnectId,
      stripeAccountStatus: vendor.stripeAccountStatus,
      accountBalance: vendor.accountBalance,
      pendingBalance: vendor.pendingBalance,
      internalAccountBalance: vendor.internalAccountBalance,
      vendorApplicationFee: vendor.vendorApplicationFee || 0.13, // Default fee if not set
      vendorPayments: vendor.vendorPayments || [],
      vendorPayouts: vendor.vendorPayouts || [],
      createdAt: vendor.createdAt?.toISOString(),
      updatedAt: vendor.updatedAt?.toISOString()
    };
  }

  // Version 1 Start
  async findPaginated(
    params: VendorPaginationParams,
  ): Promise<PaginatedVendorResponse> {
    try {
      const query = this.buildPaginationQuery(params);
      const sortOptions = this.buildSortOptions(params);

      const totalDocs = await this.vendorModel.countDocuments(query);
      const totalPages = Math.ceil(totalDocs / params.pageSize);

      let vendors = await this.vendorModel
        .find(query)
        .sort(sortOptions)
        .skip((params.page - 1) * params.pageSize)
        .limit(params.pageSize)
        .lean()
        .exec();

      // Special handling for location-based sorting
      if (params.latitude && params.longitude) {
        vendors = await this.sortByDistance(vendors, params);
      }

      return {
        data: vendors.map((vendor) => this.transformVendorResponse(vendor)),
        total: totalDocs,
        page: params.page,
        pageSize: params.pageSize,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
      };
    } catch (error) {
      console.error('Error in findPaginated:', error);
      throw new InternalServerErrorException(
        'Failed to fetch paginated vendors',
      );
    }
  }

  private buildPaginationQuery(params: VendorPaginationParams): any {
    const query: any = {};

    // Add status filter if provided
    if (params.status) {
      query.vendorStatus = params.status;
    }

    // Add type filter if provided
    if (params.type) {
      query.vendorTypes = params.type;
    }

    // Add location filters if provided
    if (params.city) {
      query.city = new RegExp(params.city, 'i');
    }

    if (params.state) {
      query.state = new RegExp(params.state, 'i');
    }

    if (params.postalCode) {
      query.postalCode = new RegExp(params.postalCode, 'i');
    }

    // Add search filter if provided
    if (params.search) {
      query.$or = [
        { businessName: new RegExp(params.search, 'i') },
        { description: new RegExp(params.search, 'i') },
      ];
    }

    return query;
  }

  private buildSortOptions(params: VendorPaginationParams): any {
    // Don't apply MongoDB sort if we're doing distance-based sorting
    if (params.latitude && params.longitude) {
      return {};
    }

    const sortOrder = params.sortOrder === SortOrder.DESC ? -1 : 1;
    return { [params.sortField]: sortOrder };
  }

  private sortByDistance(
    vendors: any[],
    params: VendorPaginationParams,
  ): any[] {
    if (!params.latitude || !params.longitude) {
      return vendors;
    }
    return vendors.sort((a, b) => {
      const distA = calculateDistance(
        params.latitude!,
        params.longitude!,
        a.latitude,
        a.longitude,
      );
      const distB = calculateDistance(
        params.latitude!,
        params.longitude!,
        b.latitude,
        b.longitude,
      );
      return distA - distB;
    });
  }

  async findByPostalCode(
    postalCode: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedVendorResponse> {
    return this.findPaginated({
      page,
      pageSize,
      sortField: VendorSortField.NAME,
      sortOrder: SortOrder.ASC,
      postalCode,
    });
  }

  async searchByName(
    name: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedVendorResponse> {
    return this.findPaginated({
      page,
      pageSize,
      sortField: VendorSortField.NAME,
      sortOrder: SortOrder.ASC,
      search: name,
    });
  }

  async findNearLocation(
    latitude: number,
    longitude: number,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedVendorResponse> {
    return this.findPaginated({
      page,
      pageSize,
      sortField: VendorSortField.NAME,
      sortOrder: SortOrder.ASC,
      latitude,
      longitude,
    });
  }

  async updateStripeStatus(id: string, stripeData: any) {
    const accountStatus = {
      chargesEnabled: stripeData.charges_enabled,
      payoutsEnabled: stripeData.payouts_enabled,
      detailsSubmitted: stripeData.details_submitted,
      currentlyDue: stripeData.requirements?.currently_due || [],
      eventuallyDue: stripeData.requirements?.eventually_due || [],
      pastDue: stripeData.requirements?.past_due || [],
      pendingVerification: stripeData.requirements?.pending_verification 
        ? {
            details: stripeData.requirements.pending_verification.details,
            dueBy: stripeData.requirements.pending_verification.due_by 
              ? new Date(stripeData.requirements.pending_verification.due_by * 1000)
              : undefined
          }
        : undefined,
      errors: this.mapStripeErrors(stripeData.requirements?.errors || [])
    };
  
    const updatedVendor = await this.vendorModel.findByIdAndUpdate(
      id,
      {
        stripeAccountStatus: accountStatus,
        updatedAt: new Date()
      },
      { new: true }
    ).lean();
  
    if (!updatedVendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
  
    return {
      data: this.transformVendorResponse(updatedVendor),
      message: 'Stripe account status updated successfully'
    };
  }
  
  private mapStripeErrors(errors: any[]): StripeRequirement[] {
    return errors.map(error => ({
      requirement: error.requirement,
      error: this.mapStripeErrorCode(error.code),
      dueDate: error.due_by ? new Date(error.due_by * 1000) : undefined
    }));
  }
  
  private mapStripeErrorCode(code: string): StripeRequirementErrorEnum {
    const errorMap: Record<string, StripeRequirementErrorEnum> = {
      invalid_address_city_state: StripeRequirementErrorEnum.INVALID_ADDRESS_CITY_STATE,
      invalid_street_address: StripeRequirementErrorEnum.INVALID_STREET_ADDRESS,
      invalid_postal_code: StripeRequirementErrorEnum.INVALID_POSTAL_CODE,
      invalid_ssn_last_4: StripeRequirementErrorEnum.INVALID_SSN_LAST_4,
      invalid_phone_number: StripeRequirementErrorEnum.INVALID_PHONE_NUMBER,
      invalid_email: StripeRequirementErrorEnum.INVALID_EMAIL,
      invalid_dob: StripeRequirementErrorEnum.INVALID_DOB,
      verification_failed_other: StripeRequirementErrorEnum.VERIFICATION_FAILED_OTHER,
      verification_document_failed: StripeRequirementErrorEnum.VERIFICATION_DOCUMENT_FAILED,
      tax_id_invalid: StripeRequirementErrorEnum.TAX_ID_INVALID
    };
    
    return errorMap[code] || StripeRequirementErrorEnum.VERIFICATION_FAILED_OTHER;
  }

  async updateVendorStripeStatus(id: string, stripeData: any) {
    const accountStatus = {
      chargesEnabled: stripeData.charges_enabled,
      payoutsEnabled: stripeData.payouts_enabled,
      detailsSubmitted: stripeData.details_submitted,
      currentlyDue: stripeData.requirements?.currently_due || [],
      eventuallyDue: stripeData.requirements?.eventually_due || [],
      pastDue: stripeData.requirements?.past_due || [],
      pendingVerification: stripeData.requirements?.pending_verification 
        ? {
            details: stripeData.requirements.pending_verification.details,
            dueBy: stripeData.requirements.pending_verification.due_by 
              ? new Date(stripeData.requirements.pending_verification.due_by * 1000)
              : undefined
          }
        : undefined,
      errors: this.mapStripeErrors(stripeData.requirements?.errors || [])
    };
  
    const updatedVendor = await this.vendorModel.findByIdAndUpdate(
      id,
      {
        stripeAccountStatus: accountStatus,
        updatedAt: new Date()
      },
      { new: true }
    ).lean();
  
    if (!updatedVendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
  
    return {
      data: this.transformVendorResponse(updatedVendor),
      message: 'Stripe account status updated successfully'
    };
  }

  async triggerPayout(vendorId: string) {
    const session = await this.vendorModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
        // Get vendor details and verify eligibility
        const vendor = await this.vendorModel.findById(vendorId).session(session);
        if (!vendor) {
          throw new NotFoundException('Vendor not found');
        }
  
        if (!vendor.stripeConnectId) {
          throw new UnprocessableEntityException('Vendor does not have Stripe account connected');
        }
  
        if (!vendor.stripeAccountStatus?.payoutsEnabled) {
          throw new UnprocessableEntityException('Vendor payouts are not enabled');
        }
  
        if (vendor.internalAccountBalance <= 0) {
          throw new UnprocessableEntityException('No balance available for payout');
        }
  
        // Convert internal balance to cents for Stripe
        const payoutAmount = Math.floor(vendor.internalAccountBalance * 100);
  
        // Create payout through Stripe
        const stripe = new Stripe(
          this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
          {
            apiVersion: '2023-08-16',
          },
        );
  
        const payout = await stripe.transfers.create({
          amount: payoutAmount,
          currency: 'usd',
          destination: vendor.stripeConnectId,
          // Schedule for next business day
          source_type: 'card',
          transfer_group: `payout_${vendor._id.toString()}`,
        });
  
        // Create transaction record
        const transaction = new this.transactionModel({
          amount: payoutAmount,
          currency: 'usd',
          vendorId: vendor._id.toString(), // Convert ObjectId to string
          status: TransactionStatus.PROCESSING,
          type: TransactionType.PAYOUT,
          description: `Payout for vendor ${vendor.businessName}`,
          metadata: {
            stripeTransferId: payout.id,
            payoutAmount: payoutAmount,
          },
        });
        await transaction.save({ session });
  
        // Update vendor balance
        vendor.internalAccountBalance = 0;
        vendor.vendorPayouts = [...vendor.vendorPayouts, transaction._id.toString()]; // Convert ObjectId to string
        await vendor.save({ session });
  
        result = {
          success: true,
          data: {
            payoutId: payout.id,
            amount: payoutAmount / 100, // Convert back to dollars for response
            currency: 'usd',
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
          },
          message: 'Payout scheduled successfully',
        };
      });
      
      return result;
    } catch (error) {
      console.error('Error processing vendor payout:', error);
      if (error instanceof NotFoundException || error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process payout');
    } finally {
      await session.endSession();
    }
  }
  
  async getStripeStatus(id: string) {
    const vendor = await this.vendorModel.findById(id)
      .select('stripeConnectId stripeAccountStatus accountBalance pendingBalance')
      .lean();
  
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }
  
    return {
      data: {
        stripeConnectId: vendor.stripeConnectId,
        accountStatus: vendor.stripeAccountStatus,
        accountBalance: vendor.accountBalance,
        pendingBalance: vendor.pendingBalance
      }
    };
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
}
