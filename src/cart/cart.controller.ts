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
  BadRequestException
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';
import { AddToCartDto, AddBookingToCartDto } from './dto/cart.dto';
import { ProductItemService } from '../product-item/product-item.service';
import { BookingAssignmentService } from '../booking-assignment/booking-assignment.service';
import { BookingItemService } from '../booking-item/booking-item.service';
import { CartItemType } from './entities/cart.schema';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly productItemService: ProductItemService,
    private readonly bookingAssignmentService: BookingAssignmentService,
    private readonly bookingItemService: BookingItemService,
  ) {}

  @Post('add')
  @ApiOperation({ summary: 'Add product item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart successfully' })
  async addToCart(@Body() addToCartDto: AddToCartDto, @Request() req) {
    const productItem = await this.productItemService.findById(addToCartDto.productItemId);
    
    const cartData = {
      itemType: CartItemType.PRODUCT,
      ...addToCartDto,
      userId: req.user.id,
      productName: productItem.data.templateName,
      price: productItem.data.price,
      productStartTime: addToCartDto.productStartTime || productItem.data.startTime,
      productDuration: productItem.data.duration,
      vendorId: productItem.data.vendorId
    };
    return this.cartService.addToCart(cartData);
  }

  @Post('add-booking')
  @ApiOperation({ summary: 'Add booking item to cart' })
  @ApiResponse({ status: 201, description: 'Booking added to cart successfully' })
  async addBookingToCart(@Body() addBookingDto: AddBookingToCartDto, @Request() req) {
    const bookingItemResponse = await this.bookingItemService.findById(addBookingDto.bookingItemId);
    
    if (!bookingItemResponse || !bookingItemResponse.data) {
      throw new BadRequestException('Booking item not found');
    }
    
    const price = typeof bookingItemResponse.data.price === 'number' ? bookingItemResponse.data.price : 0;
    
    return this.cartService.addBookingToCart({
      userId: req.user.id,
      bookingItemId: addBookingDto.bookingItemId,
      staffId: addBookingDto.staffId,
      startDateTime: addBookingDto.startDateTime,
      duration: addBookingDto.duration || bookingItemResponse.data.duration,
      vendorId: addBookingDto.vendorId,
      productName: bookingItemResponse.data.productName,
      price: price,
      quantity: 1,
      productDate: addBookingDto.startDateTime,
      productStartTime: new Date(addBookingDto.startDateTime).toTimeString().slice(0, 5),
      productDuration: addBookingDto.duration || bookingItemResponse.data.duration
    });
  }

  @Put(':productItemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated successfully' })
  async updateCartItem(
    @Param('productItemId') productItemId: string,
    @Body() updateData: { quantity: number },
    @Request() req
  ) {
    return this.cartService.updateCartItem(req.user.id, productItemId, updateData);
  }

  @Delete(':productItemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Item removed from cart successfully' })
  async removeFromCart(
    @Param('productItemId') productItemId: string,
    @Request() req
  ) {
    return this.cartService.removeFromCart(req.user.id, productItemId);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({ status: 200, description: 'Returns the current cart' })
  async getCart(@Request() req) {
    return this.cartService.getCart(req.user.id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear current cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
  async clearCart(@Request() req) {
    return this.cartService.clearCart(req.user.id);
  }
}