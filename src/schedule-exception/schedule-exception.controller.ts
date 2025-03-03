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
import { ScheduleExceptionService } from './schedule-exception.service';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto';
import { VendorService } from '../vendors/vendor.service';
import {
  ExceptionTypeEnum,
  ScheduleExceptionSchemaClass,
} from './infrastructure/persistence/document/entities/schedule-exception.schema';

@ApiTags('Schedule Exceptions')
@Controller('schedule-exceptions')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ScheduleExceptionController {
  constructor(
    private readonly scheduleExceptionService: ScheduleExceptionService,
    private readonly vendorService: VendorService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule exception' })
  @ApiResponse({
    status: 201,
    description: 'The schedule exception has been successfully created.',
  })
  async create(
    @Body() createExceptionDto: CreateScheduleExceptionDto,
    @Request() req,
  ) {
    // Check if user is authorized to create exceptions for this vendor
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      createExceptionDto.vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to create schedule exceptions for this vendor',
      );
    }

    return this.scheduleExceptionService.create(createExceptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all schedule exceptions' })
  @ApiResponse({ status: 200, description: 'Returns all schedule exceptions.' })
  @Roles(RoleEnum.admin)
  @UseGuards(RolesGuard)
  async findAll() {
    return this.scheduleExceptionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule exception by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the schedule exception details.',
  })
  async findOne(@Param('id') id: string, @Request() req) {
    const exception = await this.scheduleExceptionService.findById(id);

    // Check if user is authorized to view this exception
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      exception.data.vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to view this schedule exception',
      );
    }

    return exception;
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get all schedule exceptions for a vendor' })
  @ApiResponse({
    status: 200,
    description: 'Returns all schedule exceptions for the vendor.',
  })
  async findByVendor(@Param('vendorId') vendorId: string, @Request() req) {
    // Check if user is authorized to view vendor exceptions
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to view schedule exceptions for this vendor',
      );
    }

    return this.scheduleExceptionService.findByVendor(vendorId);
  }

  @Get('date/:date')
  @ApiOperation({ summary: 'Get all schedule exceptions for a specific date' })
  @ApiResponse({
    status: 200,
    description: 'Returns all schedule exceptions for the date.',
  })
  @ApiQuery({ name: 'vendorId', required: false, type: String })
  async findForDate(
    @Param('date') dateString: string,
    @Request() req,
    @Query('vendorId') vendorId?: string,
  ) {
    // Convert date string to Date object
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // If vendorId is provided, check authorization
    if (vendorId) {
      const isAdmin = req.user.role?.id === RoleEnum.admin;
      const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId,
      );

      if (!isAdmin && !isVendorOwner) {
        throw new UnauthorizedException(
          'Not authorized to view schedule exceptions for this vendor',
        );
      }

      return this.scheduleExceptionService.findForDate(vendorId, date);
    } else {
      // If no vendorId, only admin can view all exceptions
      if (req.user.role?.id !== RoleEnum.admin) {
        throw new UnauthorizedException(
          'Not authorized to view all schedule exceptions',
        );
      }

      return this.scheduleExceptionService.findForDate(null, date);
    }
  }

  @Get('vendor/:vendorId/date-range')
  @ApiOperation({
    summary: 'Get schedule exceptions for a vendor within a date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns exceptions within the date range.',
  })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async findByDateRange(
    @Param('vendorId') vendorId: string,
    @Query('startDate') startDateString: string,
    @Query('endDate') endDateString: string,
    @Request() req,
  ) {
    // Check if user is authorized to view vendor exceptions
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to view schedule exceptions for this vendor',
      );
    }

    // Convert date strings to Date objects
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.scheduleExceptionService.findByDateRange(
      vendorId,
      startDate,
      endDate,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a schedule exception' })
  @ApiResponse({
    status: 200,
    description: 'The schedule exception has been successfully updated.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateExceptionDto: UpdateScheduleExceptionDto,
    @Request() req,
  ) {
    const exception = await this.scheduleExceptionService.findById(id);

    // Check if user is authorized to update this exception
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      exception.data.vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to update this schedule exception',
      );
    }

    return this.scheduleExceptionService.update(id, updateExceptionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a schedule exception' })
  @ApiResponse({
    status: 200,
    description: 'The schedule exception has been successfully deleted.',
  })
  async remove(@Param('id') id: string, @Request() req) {
    const exception = await this.scheduleExceptionService.findById(id);

    // Check if user is authorized to delete this exception
    const isAdmin = req.user.role?.id === RoleEnum.admin;
    const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
      req.user.id,
      exception.data.vendorId,
    );

    if (!isAdmin && !isVendorOwner) {
      throw new UnauthorizedException(
        'Not authorized to delete this schedule exception',
      );
    }

    return this.scheduleExceptionService.remove(id);
  }

  @Get('check-booking')
  @ApiOperation({
    summary: 'Check if a booking time is affected by any exceptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns relevant exceptions if any.',
  })
  @ApiQuery({ name: 'vendorId', required: true, type: String })
  @ApiQuery({ name: 'bookingItemId', required: true, type: String })
  @ApiQuery({ name: 'roleIds', required: true, type: [String] })
  @ApiQuery({ name: 'date', required: true, type: String })
  async checkExceptionsForBookingTime(
    @Query('vendorId') vendorId: string,
    @Query('bookingItemId') bookingItemId: string,
    @Query('roleIds') roleIds: string[],
    @Query('date') dateString: string,
  ) {
    // Convert date string to Date object
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Ensure roleIds is an array
    if (!Array.isArray(roleIds)) {
      roleIds = [roleIds];
    }

    return this.scheduleExceptionService.checkExceptionsForBookingTime(
      vendorId,
      bookingItemId,
      roleIds,
      date,
    );
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple schedule exceptions at once' })
  @ApiResponse({
    status: 201,
    description: 'The schedule exceptions have been successfully created.',
  })
  async createBulk(
    @Body() createExceptionDtos: CreateScheduleExceptionDto[],
    @Request() req,
  ) {
    if (
      !Array.isArray(createExceptionDtos) ||
      createExceptionDtos.length === 0
    ) {
      throw new BadRequestException(
        'Please provide an array of schedule exceptions',
      );
    }

    // Check if user is authorized for all vendors
    const vendorIds = [
      ...new Set(createExceptionDtos.map((dto) => dto.vendorId)),
    ];

    for (const vendorId of vendorIds) {
      const isAdmin = req.user.role?.id === RoleEnum.admin;
      const isVendorOwner = await this.vendorService.isUserAssociatedWithVendor(
        req.user.id,
        vendorId,
      );

      if (!isAdmin && !isVendorOwner) {
        throw new UnauthorizedException(
          `Not authorized to create schedule exceptions for vendor ${vendorId}`,
        );
      }
    }

    // Fix: Properly type the results array
    const results: Array<{
      data: ScheduleExceptionSchemaClass;
      message: string;
    }> = [];

    for (const dto of createExceptionDtos) {
      const result = await this.scheduleExceptionService.create(dto);
      results.push(result);
    }

    return {
      message: `Successfully created ${results.length} schedule exceptions`,
      data: results.map((result) => result.data),
    };
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all available exception types' })
  @ApiResponse({ status: 200, description: 'Returns all exception types.' })
  // Remove the async keyword since there's no awaiting happening
  getExceptionTypes() {
    return {
      data: Object.values(ExceptionTypeEnum),
      message: 'Available exception types',
    };
  }
}
