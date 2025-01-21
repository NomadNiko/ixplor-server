import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
  } from '@nestjs/common';
  import { CartService } from './cart.service';
  import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { AuthGuard } from '@nestjs/passport';
  
  @ApiTags('Cart')
  @Controller('cart')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  export class CartController {
    constructor(private readonly cartService: CartService) {}
  
    @Get()
    @ApiOperation({ summary: 'Get user cart' })
    @ApiResponse({
      status: 200,
      description: 'Returns the user\'s cart',
    })
    async getCart(@Request() req) {
      return this.cartService.getCart(req.user.id);
    }
  
    @Post('add')
    @ApiOperation({ summary: 'Add item to cart' })
    @ApiResponse({
      status: 200,
      description: 'Item added to cart successfully',
    })
    async addToCart(
      @Request() req,
      @Body() addToCartDto: AddToCartDto,
    ) {
      return this.cartService.addToCart(req.user.id, addToCartDto);
    }
  
    @Put('update')
    @ApiOperation({ summary: 'Update cart item quantity' })
    @ApiResponse({
      status: 200,
      description: 'Cart item updated successfully',
    })
    async updateCartItem(
      @Request() req,
      @Body() updateCartItemDto: UpdateCartItemDto,
    ) {
      return this.cartService.updateCartItem(req.user.id, updateCartItemDto);
    }
  
    @Delete('item/:productId')
    @ApiOperation({ summary: 'Remove item from cart' })
    @ApiResponse({
      status: 200,
      description: 'Item removed from cart successfully',
    })
    async removeFromCart(
      @Request() req,
      @Param('productId') productId: string,
    ) {
      return this.cartService.removeFromCart(req.user.id, productId);
    }
  
    @Delete('clear')
    @ApiOperation({ summary: 'Clear cart' })
    @ApiResponse({
      status: 200,
      description: 'Cart cleared successfully',
    })
    async clearCart(@Request() req) {
      return this.cartService.clearCart(req.user.id);
    }
  }