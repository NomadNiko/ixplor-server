import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
  ParseFloatPipe,
  InternalServerErrorException,
} from '@nestjs/common';
import { BookingItemService } from './booking-item.service';
import { BookingItemStatusEnum } from './infrastructure/persistence/document/entities/booking-item.schema';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { CreateBookingItemDto } from './dto/create-booking-item.dto';
import { UpdateBookingItemDto } from './dto/update-booking-item.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingItemSchemaClass } from './infrastructure/persistence/document/entities/booking-item.schema';
import { VendorSearchService } from '../vendors/services/vendor-search.service';
import { BookingItemTransformService } from './services/booking-item-transform.service';

@ApiTags('Booking Items')
@Controller('booking-items')
export class BookingItemController {
  constructor(
    private readonly bookingItemService: BookingItemService,
    private readonly vendorSearchService: VendorSearchService,
    private readonly transformService: BookingItemTransformService,
    @InjectModel(BookingItemSchemaClass.name)
    private readonly bookingItemModel: Model<BookingItemSchemaClass>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all published booking items' })
  @ApiResponse({
    status: 200,
    description: 'Returns all published booking items',
  })
  async findAllPublished() {
    return await this.bookingItemService.findPublishedItems();
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Get all booking items (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all booking items (including drafts and archived)',
  })
  async findAllItems() {
    return await this.bookingItemService.findAllItems();
  }

  @Get('by-vendor/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get booking items by vendor' })
  async findByVendor(@Param('id') id: string) {
    return await this.bookingItemService.findByVendor(id);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find nearby items' })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', new ParseFloatPipe({ optional: true })) radius?: number,
  ) {
    return await this.bookingItemService.findNearby(lat, lng, radius);
  }

  @Get('nearby-today')
  @ApiOperation({ summary: 'Find nearby items for today or specified date range' })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async findNearbyToday(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', new ParseFloatPipe({ optional: true })) radius: number = 10,
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string
  ) {
    try {
      // Step 1: Find nearby vendors using the vendor search service
      const vendorResponse = await this.vendorSearchService.findNearby(lat, lng, radius);
      
      if (!vendorResponse || !vendorResponse.data || !Array.isArray(vendorResponse.data)) {
        console.warn('No vendors found nearby or invalid response structure');
        return { data: [] };
      }
      
      const nearbyVendors = vendorResponse.data;
      const vendorIds = nearbyVendors.map(v => typeof v._id === 'string' ? v._id : String(v._id));
      
      if (vendorIds.length === 0) {
        console.log('No vendor IDs found in the nearby area');
        return { data: [] };
      }

      // Step 2: Get all published booking items from these vendors
      const items = await this.bookingItemModel
        .find({
          vendorId: { $in: vendorIds },
          status: BookingItemStatusEnum.PUBLISHED,
        })
        .select('-__v')
        .lean()
        .exec();
      
      // Step 3: Add vendor location data to each booking item for distance calculation
      const enrichedItems = items.map(item => {
        const vendor = nearbyVendors.find(v => v._id.toString() === item.vendorId);
        if (vendor) {
          return {
            ...this.transformService.transformBookingItemResponse(item),
            vendorLongitude: vendor.location?.coordinates[0] || null,
            vendorLatitude: vendor.location?.coordinates[1] || null,
            vendorBusinessName: vendor.businessName || 'Unknown Vendor'
          };
        }
        return this.transformService.transformBookingItemResponse(item);
      });
      
      return {
        data: enrichedItems
      };
    } catch (error) {
      console.error('Error in findNearbyToday:', error);
      throw new InternalServerErrorException('Failed to find nearby booking items');
    }
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a new booking item' })
  @ApiResponse({
    status: 201,
    description: 'The booking item has been successfully created.',
  })
  async create(@Body() createBookingItemDto: CreateBookingItemDto) {
    return await this.bookingItemService.create(createBookingItemDto);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin, RoleEnum.vendor, RoleEnum.prevendor)
  @ApiOperation({ summary: 'Update booking item status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingItemStatusEnum,
  ) {
    return await this.bookingItemService.updateStatus(id, status);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update a booking item' })
  @ApiResponse({
    status: 200,
    description: 'The booking item has been successfully updated.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBookingItemDto: UpdateBookingItemDto,
  ) {
    return await this.bookingItemService.update(id, updateBookingItemDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete a booking item' })
  @ApiResponse({
    status: 200,
    description: 'The booking item has been successfully deleted.',
  })
  async remove(@Param('id') id: string) {
    return await this.bookingItemService.remove(id);
  }

  // Keep this as the last route
  @Get(':id')
  @ApiOperation({ summary: 'Get booking item by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns a single booking item',
  })
  async findById(@Param('id') id: string) {
    return await this.bookingItemService.findById(id);
  }
}