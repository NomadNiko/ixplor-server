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
  
  @ApiTags('Booking Items')
  @Controller('booking-items')
  export class BookingItemController {
    constructor(private readonly bookingItemService: BookingItemService) {}
  
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
    
    @Get(':id')
    @ApiOperation({ summary: 'Get booking item by ID' })
    @ApiResponse({
      status: 200,
      description: 'Returns a single booking item',
    })
    async findById(@Param('id') id: string) {
      return await this.bookingItemService.findById(id);
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
  }