import { 
  Controller, 
  Post, 
  Body, 
  Headers,
  Req,
  UseGuards,
  Get,
  Query,
  Request,
  RawBodyRequest
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartItemClass } from '../cart/entities/cart.schema';
import Stripe from 'stripe';
import { Request as ExpressRequest } from 'express';

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
    @Req() request: RawBodyRequest<ExpressRequest>
  ) {
    try {
      // Get the raw body from the request
      const rawBody = request.rawBody;
      
      if (!rawBody || !(rawBody instanceof Buffer)) {
        throw new Error('Missing or invalid raw body');
      }

      return await this.stripeService.handleWebhookEvent(
        signature,
        rawBody
      );
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }
}