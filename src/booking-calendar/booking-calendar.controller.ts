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
  Request,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { BookingCalendarService } from './booking-calendar.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingStatusEnum } from './infrastructure/persistence/document/entities/booking-calendar.schema';
import { VendorService } from '../vendors/vendor.service';
import { BookingItemAvailabilityResponse } from './types';

@ApiTags('Booking Calendar')
@Controller('booking-calendar')
export class BookingCalendarController {
  constructor(
    private readonly bookingCalendarService: BookingCalendarService,
    private readonly vendorService: VendorService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({
    status: 201,
    description: 'The booking has been successfully created.',
  })
  async create(@Body() createBookingDto: CreateBookingDto, @Request() req) {
    // Check if user is booking for themselves or is admin/vendor
    if (createBookingDto.customerId !== req.user.id) {
      // For non-self bookings, check authorization
      const isAdmin = req.user.role?.id === RoleEnum.admin;
      const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        createBookingDto.vendorId,
      );

      if (!isAdmin && !isVendorOwner) {
        throw new UnauthorizedException(
          'Not authorized to create bookings for other users',
        );
      }
    }

    return this.bookingCalendarService.create(createBookingDto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Returns the booking details.' })
  async findOne(@Param('id') id: string, @Request() req) {
    const booking = await this.bookingCalendarService.findById(id);

    // Check if user is authorized to view this booking
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      booking.data.vendorId,
    );
    const isCustomer = booking.data.customerId === req.user.id;

    if (!isAdmin && !isVendorOwner && !isCustomer) {
      throw new UnauthorizedException('Not authorized to view this booking');
    }

    return booking;
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a booking' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully updated.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Request() req,
  ) {
    const booking = await this.bookingCalendarService.findById(id);

    // Check if user is authorized to update this booking
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      booking.data.vendorId,
    );
    const isCustomer = booking.data.customerId === req.user.id;

    // Customers can only cancel their own bookings, not modify them
    if (
      isCustomer &&
      !isAdmin &&
      !isVendorOwner &&
      updateBookingDto.status !== BookingStatusEnum.CANCELLED
    ) {
      throw new UnauthorizedException(
        'Customers can only cancel bookings, not modify them',
      );
    }

    if (!isAdmin && !isVendorOwner && !isCustomer) {
      throw new UnauthorizedException('Not authorized to update this booking');
    }

    return this.bookingCalendarService.update(id, updateBookingDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a booking (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'The booking has been successfully deleted.',
  })
  async remove(@Param('id') id: string) {
    return this.bookingCalendarService.delete(id);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully.',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() statusUpdate: { status: BookingStatusEnum; reason?: string },
    @Request() req,
  ) {
    const booking = await this.bookingCalendarService.findById(id);

    // Check if user is authorized to update this booking
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      booking.data.vendorId,
    );
    const isCustomer = booking.data.customerId === req.user.id;

    // Customers can only cancel their own bookings
    if (
      isCustomer &&
      !isAdmin &&
      !isVendorOwner &&
      statusUpdate.status !== BookingStatusEnum.CANCELLED
    ) {
      throw new UnauthorizedException('Customers can only cancel bookings');
    }

    if (!isAdmin && !isVendorOwner && !isCustomer) {
      throw new UnauthorizedException('Not authorized to update this booking');
    }

    return this.bookingCalendarService.updateStatus(
      id,
      statusUpdate.status,
      statusUpdate.reason,
    );
  }

  @Get('vendor/:vendorId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a vendor' })
  @ApiResponse({ status: 200, description: 'Returns vendor bookings.' })
  @ApiQuery({ name: 'date', required: false, type: Date })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatusEnum })
  async findByVendor(
    @Param('vendorId') vendorId: string,
    @Request() req,
    @Query('date') dateString?: string,
    @Query('status') status?: BookingStatusEnum,
  ) {
    // Check if user is authorized to view vendor bookings
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to view bookings for this vendor',
      );
    }

    const date = dateString ? new Date(dateString) : undefined;

    return this.bookingCalendarService.findByVendor(vendorId, date, status);
  }

  @Get('role/:roleId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a role' })
  @ApiResponse({ status: 200, description: 'Returns role bookings.' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async findByRole(
    @Param('roleId') roleId: string,
    @Request() req,
    @Query('startDate') startDateString?: string,
    @Query('endDate') endDateString?: string,
  ) {
    // First find one booking or role to determine the vendor
    let vendorId: string;

    try {
      const roleBookings = await this.bookingCalendarService.findByRole(roleId);
      if (roleBookings.data.length > 0) {
        vendorId = roleBookings.data[0].vendorId;
      } else {
        // If no bookings, try to get vendorId from role directly
        const staffRoleService = req.app.get('StaffRoleService');
        const role = await staffRoleService.findById(roleId);
        vendorId = role.data.vendorId;
      }
    } catch (error) {
      throw new NotFoundException('Role not found or has no bookings');
    }

    // Check if user is authorized to view role bookings
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to view bookings for this role',
      );
    }

    const startDate = startDateString ? new Date(startDateString) : undefined;
    const endDate = endDateString ? new Date(endDateString) : undefined;

    return this.bookingCalendarService.findByRole(roleId, startDate, endDate);
  }

  @Get('staff/:staffId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a staff member' })
  @ApiResponse({ status: 200, description: 'Returns staff bookings.' })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  async findByStaff(
    @Param('staffId') staffId: string,
    @Request() req,
    @Query('startDate') startDateString?: string,
    @Query('endDate') endDateString?: string,
  ) {
    // First find one booking to determine the vendor
    let vendorId: string;

    try {
      const staffBookings = await this.bookingCalendarService.findByStaff(
        staffId,
      );
      if (staffBookings.data.length > 0) {
        vendorId = staffBookings.data[0].vendorId;
      } else {
        // If no bookings, try to get vendorId from staff directly
        const staffUserService = req.app.get('StaffUserService');
        const staff = await staffUserService.findById(staffId);
        vendorId = staff.data.vendorId;
      }
    } catch (error) {
      throw new NotFoundException('Staff not found or has no bookings');
    }

    // Check if user is authorized to view staff bookings
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );
    const isStaffMember = staffId === req.user.id;

    if (!isAdmin && !isVendorOwner && !isStaffMember) {
      throw new UnauthorizedException(
        'Not authorized to view bookings for this staff member',
      );
    }

    const startDate = startDateString ? new Date(startDateString) : undefined;
    const endDate = endDateString ? new Date(endDateString) : undefined;

    return this.bookingCalendarService.findByStaff(staffId, startDate, endDate);
  }

  @Get('customer/me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for the current user' })
  @ApiResponse({ status: 200, description: 'Returns customer bookings.' })
  async findForCurrentUser(@Request() req) {
    return this.bookingCalendarService.findByCustomer(req.user.id);
  }

  @Get('customer/:customerId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a customer (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns customer bookings.' })
  async findByCustomer(@Param('customerId') customerId: string) {
    return this.bookingCalendarService.findByCustomer(customerId);
  }

  @Put(':id/assign-staff/:staffId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign staff to a booking' })
  @ApiResponse({ status: 200, description: 'Staff assigned successfully.' })
  async assignStaff(
    @Param('id') id: string,
    @Param('staffId') staffId: string,
    @Request() req,
  ) {
    const booking = await this.bookingCalendarService.findById(id);

    // Check if user is authorized to assign staff
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      booking.data.vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to assign staff to bookings',
      );
    }

    return this.bookingCalendarService.assignStaff(id, staffId);
  }

  @Get('availability/role/:roleId')
  @ApiOperation({ summary: 'Check availability for a role at a specific time' })
  @ApiResponse({
    status: 200,
    description: 'Returns availability information.',
  })
  @ApiQuery({ name: 'date', required: true, type: Date })
  @ApiQuery({ name: 'duration', required: true, type: Number })
  async checkRoleAvailability(
    @Param('roleId') roleId: string,
    @Query('date') dateString: string,
    @Query('duration') duration: number,
  ) {
    if (!dateString) {
      throw new BadRequestException('Date is required');
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      throw new BadRequestException('Valid duration is required');
    }

    return this.bookingCalendarService.checkRoleAvailability(
      roleId,
      date,
      Number(duration),
    );
  }

  @Get('availability/booking-item/:bookingItemId')
  async findBookingItemAvailability(
    @Param('bookingItemId') bookingItemId: string,
    @Query('date') dateString: string,
  ): Promise<BookingItemAvailabilityResponse> {
    if (!dateString) {
      throw new BadRequestException('Date is required');
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.bookingCalendarService.findAvailabilityForBookingItem(
      bookingItemId,
      date,
    );
  }
}
