import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { StripeConnectService } from './stripe-connect.service';
import { StripeAccountSessionDto } from './dto/stripe-connect.dto';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';

@ApiTags('Stripe Connect')
@Controller('stripe-connect')
export class StripeConnectController {
  constructor(
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  @Post('account')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Connect account' })
  @ApiResponse({
    status: 200,
    description: 'Returns the created account ID',
  })
  async createAccount() {
    try {
      const account = await this.stripeConnectService.createConnectAccount();
      return { account: account.id };
    } catch (error) {
      console.error('An error occurred when calling the Stripe API to create an account:', error);
      throw error;
    }
  }

  @Post('account-session')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Connect account session' })
  @ApiResponse({
    status: 200,
    description: 'Returns the account session client secret',
  })
  async createAccountSession(@Body() body: StripeAccountSessionDto) {
    try {
      const accountSession = await this.stripeConnectService.createAccountSession(body.account);
      return {
        client_secret: accountSession.client_secret,
      };
    } catch (error) {
      console.error(
        "An error occurred when calling the Stripe API to create an account session",
        error
      );
      throw error;
    }
  }
}