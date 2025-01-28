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
    DefaultValuePipe,
    ParseIntPipe
  } from '@nestjs/common';
  import { StripeService } from './stripe.service';
  import { AuthGuard } from '@nestjs/passport';
  import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
  import { TransactionService } from '../transactions/transaction.service';
  import { TransactionFilters } from '../transactions/types/transaction-filters.type';
  
  @ApiTags('Stripe')
  @Controller('stripe')
  export class StripeController {
    constructor(
        private readonly stripeService: StripeService,
        private readonly transactionService: TransactionService
      ) {}
  
    @Post('create-payment-intent')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async createPaymentIntent(@Body() body: {
      amount: number;
      currency: string;
      vendorId: string;
      customerId: string;
      productId: string;
      description?: string;
      metadata?: Record<string, any>;
    }) {
      return this.stripeService.createPaymentIntent(body);
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
  
    @Get('transactions')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async getTransactions(
      @Query() filters: TransactionFilters,
      @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
      @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
      @Query('sortBy') sortBy?: string,
      @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ) {
      return this.transactionService.findWithPagination(
        filters,
        { page, limit, sortBy, sortOrder }
      );
    }
  
    @Get('transactions/stats')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    async getTransactionStats(@Query('vendorId') vendorId?: string) {
      return this.transactionService.getTransactionStats(vendorId);
    }
  }