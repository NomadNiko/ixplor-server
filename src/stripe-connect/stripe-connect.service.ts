import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeBalanceResponseDto } from './dto/stripe-balance.dto';


@Injectable()
export class StripeConnectService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY', { infer: true }) ?? '',
      { apiVersion: '2023-08-16' }
    );
  }

  async getOrCreateConnectAccount(existingAccountId?: string) {
    if (existingAccountId) {
      try {
        const existingAccount = await this.stripe.accounts.retrieve(existingAccountId);
        return existingAccount;
      } catch (error) {
        console.error('Error retrieving existing Stripe account:', error);
        // If the account doesn't exist or there's an error, we'll create a new one
      }
    }

    return this.stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    });
  }
  
  async createConnectAccount() {
    return this.stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'manual',
          },
        },
      },
    });
  }

  async createAccountSession(accountId: string) {
    return this.stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });
  }

  async getAccountDetails(accountId: string) {
    return this.stripe.accounts.retrieve(accountId);
  }

  async getAccountBalance(stripeAccountId: string): Promise<StripeBalanceResponseDto> {
    try {
      const balance = await this.stripe.balance.retrieve({ 
        stripeAccount: stripeAccountId 
      });

      // Extract available and pending balances
      const availableBalance = balance.available[0]?.amount || 0;
      const pendingBalance = balance.pending[0]?.amount || 0;

      return {
        availableBalance: availableBalance / 100, // Convert from cents to dollars
        pendingBalance: pendingBalance / 100
      };
    } catch (error) {
      console.error('Error retrieving Stripe account balance:', error);
      throw new InternalServerErrorException('Failed to retrieve Stripe account balance');
    }
  }
}