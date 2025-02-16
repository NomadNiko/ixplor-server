import { Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  VendorSchemaClass,
  VendorSchemaDocument,
  StripeRequirement,
  StripeRequirementErrorEnum,
} from '../infrastructure/persistence/document/entities/vendor.schema';
import { TransactionSchemaClass } from '../../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { TransactionStatus, TransactionType } from '../../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { transformVendorResponse } from '../../utils/vendor.transform';
import { PayoutSchemaClass, PayoutStatus } from 'src/payout/infrastructure/persistence/document/entities/payout.schema';
import { StripeBalanceResponseDto } from '../../stripe-connect/dto/stripe-balance.dto';
import { StripeConnectService } from '../../stripe-connect/stripe-connect.service';

@Injectable()
export class VendorStripeService {
  private stripe: Stripe;
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(PayoutSchemaClass.name)
    private readonly payoutModel: Model<PayoutSchemaClass>,
    private readonly configService: ConfigService,
    private readonly stripeConnectService: StripeConnectService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
      {
        apiVersion: '2025-01-27.acacia',
      }
    );
  }

  async retrieveAndUpdateStripeBalance(vendorId: string): Promise<StripeBalanceResponseDto> {
    try {
      // Find the vendor to get their Stripe Connect ID
      const vendor = await this.vendorModel.findById(vendorId);
      
      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }

      if (!vendor.stripeConnectId) {
        throw new InternalServerErrorException('Vendor does not have a Stripe Connect account');
      }

      // Retrieve balance from Stripe
      const balance = await this.stripeConnectService.getAccountBalance(vendor.stripeConnectId);

      // Update vendor with new balance
      vendor.accountBalance = Math.round(balance.availableBalance * 100);
      vendor.pendingBalance = Math.round(balance.pendingBalance * 100);

      await vendor.save();

      return balance;
    } catch (error) {
      console.error('Error retrieving and updating Stripe balance:', error);
      throw error;
    }
  }

  async updateStripeConnectId(vendorId: string, stripeConnectId: string) {
    try {
      const updatedVendor = await this.vendorModel.findByIdAndUpdate(
        vendorId,
        { 
          stripeConnectId,
          updatedAt: new Date()
        },
        { new: true }
      ).lean();
  
      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }
  
      return {
        data: transformVendorResponse(updatedVendor),
        message: 'Stripe Connect ID updated successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating Stripe Connect ID:', error);
      throw new InternalServerErrorException('Failed to update Stripe Connect ID');
    }
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
      data: transformVendorResponse(updatedVendor),
      message: 'Stripe account status updated successfully'
    };
  }

  async triggerPayout(vendorId: string) {
    const session = await this.vendorModel.db.startSession();
    
    try {
      let result;
      await session.withTransaction(async () => {
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

        const payoutAmount = Math.floor(vendor.internalAccountBalance * 100);

        const payout = await this.stripe.transfers.create({
          amount: payoutAmount,
          currency: 'usd',
          destination: vendor.stripeConnectId,
          source_type: 'card',
          transfer_group: `payout_${vendor._id.toString()}`,
        });

        const payoutRecord = new this.payoutModel({
          vendorId: vendor._id.toString(),
          amount: payoutAmount,
          status: PayoutStatus.PROCESSING,
          description: `Payout for vendor ${vendor.businessName}`,
          stripeTransferDetails: {
            transferId: payout.id,
            destination: payout.destination,
            sourceType: payout.source_type,
            transferGroup: payout.transfer_group
          },
          processedAt: new Date()
        });
        await payoutRecord.save({ session });

        vendor.internalAccountBalance = 0;
        vendor.vendorPayouts = [...vendor.vendorPayouts, payoutRecord._id.toString()];
        await vendor.save({ session });

        result = {
          success: true,
          data: {
            payoutId: payoutRecord._id.toString(),
            transferId: payout.id,
            amount: payoutAmount / 100,
            currency: 'usd',
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          message: 'Payout scheduled successfully',
        };
      });
      
      return result;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnprocessableEntityException) {
        throw error;
      }
      console.error('Error processing vendor payout:', error);
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

   mapStripeErrors(errors: any[]): StripeRequirement[] {
    return errors.map(error => ({
      requirement: error.requirement,
      error: this.mapStripeErrorCode(error.code),
      dueDate: error.due_by ? new Date(error.due_by * 1000) : undefined
    }));
  }

   mapStripeErrorCode(code: string): StripeRequirementErrorEnum {
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
}