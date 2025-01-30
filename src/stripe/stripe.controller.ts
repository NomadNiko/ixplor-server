import { 
  Controller, 
  Post, 
  Body, 
  Headers,
  UseGuards,
  Get,
  Query,
  Request,
  InternalServerErrorException
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartItemClass } from '../cart/entities/cart.schema';
import Stripe from 'stripe';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private stripe: Stripe;
  constructor(
    private readonly stripeService: StripeService
  ) {}

  @Post('create-checkout-session')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async createCheckoutSession(
    @Body() body: {
      items: CartItemClass[];
      returnUrl: string;
    },
    @Request() req
  ) {
    return this.stripeService.createCheckoutSession({
      ...body,
      customerId: req.user.id
    });
  }

  @Get('session-status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async getSessionStatus(
    @Query('session_id') sessionId: string
  ) {
    return this.stripeService.getSessionStatus(sessionId);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() body: any
  ) {
    try {
      const payloadString = JSON.stringify(body);
      const payload = Buffer.from(payloadString);
      
      return await this.stripeService.handleWebhookEvent(
        signature,
        payload
      );
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }
}