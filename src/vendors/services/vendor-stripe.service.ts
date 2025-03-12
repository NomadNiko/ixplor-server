import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
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
import {
  TransactionStatus,
  TransactionType,
} from '../../transactions/infrastructure/persistence/document/entities/transaction.schema';
import { transformVendorResponse } from '../../utils/vendor.transform';
import {
  PayoutSchemaClass,
  PayoutStatus,
} from 'src/payout/infrastructure/persistence/document/entities/payout.schema';
import { StripeBalanceResponseDto } from '../../stripe-connect/dto/stripe-balance.dto';
import { StripeConnectService } from '../../stripe-connect/stripe-connect.service';
import { MailService } from '../../mail/mail.service';
import { VendorEmailData } from '../../mail/interfaces/vendor-email-data.interface';
import { UserSchemaClass } from '../../users/infrastructure/persistence/document/entities/user.schema';

@Injectable()
export class VendorStripeService {
  private stripe: Stripe;
  constructor(
    @InjectModel(VendorSchemaClass.name)
    private readonly vendorModel: Model<VendorSchemaDocument>,
    @InjectModel(PayoutSchemaClass.name)
    private readonly payoutModel: Model<PayoutSchemaClass>,
    @InjectModel(UserSchemaClass.name)
    private readonly userModel: Model<UserSchemaClass>,
    private readonly configService: ConfigService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly mailService: MailService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ??
        '',
      {
        apiVersion: '2025-01-27.acacia',
      },
    );
  }

  async retrieveAndUpdateStripeBalance(
    vendorId: string,
  ): Promise<StripeBalanceResponseDto> {
    try {
      // Find the vendor to get their Stripe Connect ID
      const vendor = await this.vendorModel.findById(vendorId);

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }

      if (!vendor.stripeConnectId) {
        throw new InternalServerErrorException(
          'Vendor does not have a Stripe Connect account',
        );
      }

      // Retrieve balance from Stripe
      const balance = await this.stripeConnectService.getAccountBalance(
        vendor.stripeConnectId,
      );

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
      const updatedVendor = await this.vendorModel
        .findByIdAndUpdate(
          vendorId,
          {
            stripeConnectId,
            updatedAt: new Date(),
          },
          { new: true },
        )
        .lean();

      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
      }

      return {
        data: transformVendorResponse(updatedVendor),
        message: 'Stripe Connect ID updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating Stripe Connect ID:', error);
      throw new InternalServerErrorException(
        'Failed to update Stripe Connect ID',
      );
    }
  }

  /**
   * Comprehensively checks if a Stripe account has completed the onboarding process
   * and is ready to process payments.
   * 
   * @param stripeData The Stripe account object from the API
   * @returns boolean indicating if onboarding is complete
   */
  private isStripeOnboardingComplete(stripeData: any): boolean {
    // Check the most fundamental requirements first
    if (!stripeData.details_submitted) {
      console.log('Stripe onboarding incomplete: details not submitted');
      return false;
    }

    if (!stripeData.charges_enabled) {
      console.log('Stripe onboarding incomplete: charges not enabled');
      return false;
    }

    if (!stripeData.payouts_enabled) {
      console.log('Stripe onboarding incomplete: payouts not enabled');
      return false;
    }

    // Check if there are any requirements that are currently due or past due
    if (
      stripeData.requirements?.currently_due?.length > 0 ||
      stripeData.requirements?.past_due?.length > 0
    ) {
      console.log('Stripe onboarding incomplete: requirements still pending', {
        currently_due: stripeData.requirements?.currently_due,
        past_due: stripeData.requirements?.past_due,
      });
      return false;
    }

    // Check if there's a disabled reason
    if (stripeData.requirements?.disabled_reason) {
      console.log('Stripe onboarding incomplete: account disabled', {
        reason: stripeData.requirements.disabled_reason,
      });
      return false;
    }

    // Check if capabilities needed for our platform are active
    const hasRequiredCapabilities = 
      stripeData.capabilities?.card_payments === 'active' && 
      stripeData.capabilities?.transfers === 'active';
    
    if (!hasRequiredCapabilities) {
      console.log('Stripe onboarding incomplete: required capabilities not active', {
        capabilities: stripeData.capabilities,
      });
      return false;
    }

    // If we passed all checks, the account is ready
    console.log('Stripe onboarding complete: all checks passed');
    return true;
  }

  async updateStripeStatus(id: string, stripeData: any) {
    try {
      // Get current vendor state to check if this is a completion change
      const currentVendor = await this.vendorModel.findById(id);
      if (!currentVendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      // Store complete Stripe account info
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
                ? new Date(
                    stripeData.requirements.pending_verification.due_by * 1000,
                  )
                : undefined,
            }
          : undefined,
        errors: this.mapStripeErrors(stripeData.requirements?.errors || []),
      };

      const updatedVendor = await this.vendorModel.findByIdAndUpdate(
        id,
        {
          stripeAccountStatus: accountStatus,
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedVendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      // Check if the account was previously not fully onboarded and is now complete
      const wasFullyOnboarded = this.isVendorStripeAccountComplete(currentVendor);
      const isNowFullyOnboarded = this.isStripeOnboardingComplete(stripeData);
      
      // Only send notification if the account has just completed onboarding
      if (!wasFullyOnboarded && isNowFullyOnboarded) {
        console.log('Stripe onboarding just completed for vendor', id);
        await this.notifyOwnersOfStripeCompletion(updatedVendor, stripeData);
      }

      return {
        data: transformVendorResponse(updatedVendor.toObject()),
        message: 'Stripe account status updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating Stripe status:', error);
      throw new InternalServerErrorException(
        'Failed to update Stripe account status',
      );
    }
  }

  /**
   * Check if a vendor's stored Stripe account data indicates a complete account
   */
  private isVendorStripeAccountComplete(vendor: VendorSchemaClass): boolean {
    if (!vendor.stripeAccountStatus) return false;
    
    const status = vendor.stripeAccountStatus;
    
    // Check basic requirements
    if (!status.detailsSubmitted || !status.chargesEnabled || !status.payoutsEnabled) {
      return false;
    }
    
    // Check if there are pending requirements
    if (
      (status.currentlyDue && status.currentlyDue.length > 0) ||
      (status.pastDue && status.pastDue.length > 0)
    ) {
      return false;
    }
    
    return true;
  }

  private async notifyOwnersOfStripeCompletion(
    vendor: VendorSchemaClass,
    stripeData: any,
  ): Promise<void> {
    try {
      if (!vendor.ownerIds || vendor.ownerIds.length === 0) {
        console.log(`No owners found for vendor ${(vendor as any)._id}`);
        return;
      }

      // Perform one final verification before sending emails
      if (!this.isStripeOnboardingComplete(stripeData)) {
        console.log(`Aborting email notification: Stripe onboarding not fully complete for vendor ${(vendor as any)._id}`);
        return;
      }

      // Prepare vendor status URL
      const frontendDomain = this.configService.get('app.frontendDomain', {
        infer: true,
      });
      const vendorStatusUrl = `${frontendDomain}/vendor-status`;

      for (const ownerId of vendor.ownerIds) {
        const user = await this.userModel.findById(ownerId);
        if (!user || !user.email) continue;

        const userName =
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

        // Prepare email data
        const emailData: VendorEmailData = {
          vendorId: (vendor as any)._id.toString(),
          vendorName: vendor.businessName,
          vendorStatus: vendor.vendorStatus,
          userName,
          eventType: 'stripe-complete',
          vendorStatusUrl,
          stripeInfo: {
            accountId: stripeData.id,
            chargesEnabled: stripeData.charges_enabled,
            payoutsEnabled: stripeData.payouts_enabled,
          },
        };

        // Send email
        await this.mailService.sendVendorStripeCompleteEmail({
          to: user.email,
          data: emailData,
        });

        console.log(
          `Stripe completion email sent to ${user.email} for vendor ${vendor.businessName}`,
        );
      }
    } catch (error) {
      console.error('Error sending Stripe completion emails:', error);
      // Don't throw error to prevent disrupting vendor update
    }
  }

  async triggerPayout(vendorId: string) {
    const session = await this.vendorModel.db.startSession();

    try {
      let result;
      await session.withTransaction(async () => {
        const vendor = await this.vendorModel
          .findById(vendorId)
          .session(session);
        if (!vendor) {
          throw new NotFoundException('Vendor not found');
        }

        if (!vendor.stripeConnectId) {
          throw new UnprocessableEntityException(
            'Vendor does not have Stripe account connected',
          );
        }

        if (!vendor.stripeAccountStatus?.payoutsEnabled) {
          throw new UnprocessableEntityException(
            'Vendor payouts are not enabled',
          );
        }

        // Do a final comprehensive check before allowing payout
        const stripeAccount = await this.stripe.accounts.retrieve(vendor.stripeConnectId);
        if (!this.isStripeOnboardingComplete(stripeAccount)) {
          throw new UnprocessableEntityException(
            'Stripe account setup is not complete. Please complete all required information on Stripe.',
          );
        }

        if (vendor.internalAccountBalance <= 0) {
          throw new UnprocessableEntityException(
            'No balance available for payout',
          );
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
            transferGroup: payout.transfer_group,
          },
          processedAt: new Date(),
        });
        await payoutRecord.save({ session });

        vendor.internalAccountBalance = 0;
        vendor.vendorPayouts = [
          ...vendor.vendorPayouts,
          payoutRecord._id.toString(),
        ];
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
      if (
        error instanceof NotFoundException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      console.error('Error processing vendor payout:', error);
      throw new InternalServerErrorException('Failed to process payout');
    } finally {
      await session.endSession();
    }
  }

  async getStripeStatus(id: string) {
    const vendor = await this.vendorModel
      .findById(id)
      .select(
        'stripeConnectId stripeAccountStatus accountBalance pendingBalance',
      )
      .lean();

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${id} not found`);
    }

    // If we have a stripeConnectId, fetch real-time data
    if (vendor.stripeConnectId) {
      try {
        const stripeAccount = await this.stripe.accounts.retrieve(vendor.stripeConnectId);
        const isComplete = this.isStripeOnboardingComplete(stripeAccount);
        
        return {
          data: {
            stripeConnectId: vendor.stripeConnectId,
            accountStatus: vendor.stripeAccountStatus,
            accountBalance: vendor.accountBalance,
            pendingBalance: vendor.pendingBalance,
            isComplete: isComplete,
            setupProgress: this.calculateSetupProgress(stripeAccount)
          },
        };
      } catch (error) {
        console.error('Error fetching real-time Stripe status:', error);
        // Fall back to stored data if Stripe API call fails
      }
    }

    return {
      data: {
        stripeConnectId: vendor.stripeConnectId,
        accountStatus: vendor.stripeAccountStatus,
        accountBalance: vendor.accountBalance,
        pendingBalance: vendor.pendingBalance,
        isComplete: this.isVendorStripeAccountComplete(vendor as VendorSchemaClass),
        setupProgress: 0 // Cannot calculate without Stripe data
      },
    };
  }

  /**
   * Calculate an approximate setup progress percentage based on Stripe account data
   */
  private calculateSetupProgress(stripeData: any): number {
    if (!stripeData) return 0;
    
    // Start with basic profile weight
    let progress = 10; // 10% just for having an account
    
    // Add weight for details submitted
    if (stripeData.details_submitted) progress += 30;
    
    // Add weights for charges and payouts
    if (stripeData.charges_enabled) progress += 20;
    if (stripeData.payouts_enabled) progress += 20;
    
    // Calculate requirement progress
    const totalRequirements = 
      (stripeData.requirements?.eventually_due?.length || 0) + 
      (stripeData.requirements?.currently_due?.length || 0) + 
      (stripeData.requirements?.past_due?.length || 0);
    
    // If there are no requirements at all, give the remaining 20%
    if (totalRequirements === 0) {
      progress += 20;
    } else {
      // Otherwise, calculate based on requirements left
      // This assumes 20 as an average number of total requirements
      const standardTotalRequirements = 20;
      const remainingRequirementsWeight = 20 * (1 - (totalRequirements / standardTotalRequirements));
      // Cap at 20% and ensure it's not negative
      progress += Math.min(20, Math.max(0, remainingRequirementsWeight));
    }
    
    // Ensure we don't exceed 100%
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  mapStripeErrors(errors: any[]): StripeRequirement[] {
    return errors.map((error) => ({
      requirement: error.requirement,
      error: this.mapStripeErrorCode(error.code),
      dueDate: error.due_by ? new Date(error.due_by * 1000) : undefined,
    }));
  }

  mapStripeErrorCode(code: string): StripeRequirementErrorEnum {
    const errorMap: Record<string, StripeRequirementErrorEnum> = {
      invalid_address_city_state:
        StripeRequirementErrorEnum.INVALID_ADDRESS_CITY_STATE,
      invalid_street_address: StripeRequirementErrorEnum.INVALID_STREET_ADDRESS,
      invalid_postal_code: StripeRequirementErrorEnum.INVALID_POSTAL_CODE,
      invalid_ssn_last_4: StripeRequirementErrorEnum.INVALID_SSN_LAST_4,
      invalid_phone_number: StripeRequirementErrorEnum.INVALID_PHONE_NUMBER,
      invalid_email: StripeRequirementErrorEnum.INVALID_EMAIL,
      invalid_dob: StripeRequirementErrorEnum.INVALID_DOB,
      verification_failed_other:
        StripeRequirementErrorEnum.VERIFICATION_FAILED_OTHER,
      verification_document_failed:
        StripeRequirementErrorEnum.VERIFICATION_DOCUMENT_FAILED,
      tax_id_invalid: StripeRequirementErrorEnum.TAX_ID_INVALID,
    };

    return (
      errorMap[code] || StripeRequirementErrorEnum.VERIFICATION_FAILED_OTHER
    );
  }
}