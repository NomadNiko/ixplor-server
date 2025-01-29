import { 
  Controller, 
  Post, 
  Body, 
  Headers,
  RawBodyRequest,
  Req,
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
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        status: session.status,
        customer_email: session.customer_email
      };
    } catch (error) {
      console.error('Error retrieving session status:', error);
      throw new InternalServerErrorException('Failed to retrieve session status');
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>
  ) {
    return this.stripeService.handleWebhookEvent(
      signature,
      request.rawBody as Buffer
    );
  }
}