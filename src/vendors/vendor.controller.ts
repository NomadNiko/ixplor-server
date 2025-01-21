import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorType } from './infrastructure/persistence/document/entities/vendor.schema';
import { ApiQuery, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';

@ApiTags('Vendors')
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll() {
    return this.vendorService.findAllApproved();
  }

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  async findAllVendors() {
    return this.vendorService.findAllVendors();
  }

  @Get(':id/owners')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Get vendor owners' })
  @ApiResponse({
    status: 200,
    description: 'Returns the owners of a vendor',
  })
  async getVendorOwners(@Param('id') id: string) {
    return this.vendorService.getVendorOwners(id);
  }

  @Get('nearby')
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number,
  ) {
    return this.vendorService.findNearby(
      Number(lat),
      Number(lng),
      radius ? Number(radius) : undefined,
    );
  }

  @Get('by-type')
  @ApiQuery({
    name: 'type',
    enum: ['tours', 'lessons', 'rentals', 'tickets'],
    required: true,
  })
  async findByType(@Query('type') type: string) {
    // Validate that the type is a valid VendorType
    const validTypes: VendorType[] = ['tours', 'lessons', 'rentals', 'tickets'];
    if (!validTypes.includes(type as VendorType)) {
      throw new BadRequestException(
        `Invalid vendor type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    return this.vendorService.findByType(type as VendorType);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a new vendor' })
  @ApiResponse({
    status: 201,
    description: 'The vendor has been successfully created.',
  })
  async create(@Body() createVendorDto: CreateVendorDto, @Request() req) {
    return this.vendorService.create(createVendorDto, req.user.id);
  }

  @Post('admin/approve/:vendorId/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({
    summary: 'Approve a vendor and update user role (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'The vendor has been approved and user role updated if needed',
  })
  async approveVendor(
    @Param('vendorId') vendorId: string,
    @Param('userId') userId: string,
  ) {
    return this.vendorService.approveVendor(vendorId, userId);
  }

  @Get('admin/user/:userId/vendors')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Update a vendor' })
  @ApiResponse({
    status: 200,
    description: 'The vendor has been successfully updated.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateData: any, // We'll define proper DTO later
  ) {
    const updatedVendor = await this.vendorService.update(id, updateData);
    return { data: updatedVendor };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete a vendor' })
  @ApiResponse({
    status: 200,
    description: 'The vendor has been successfully deleted.',
  })
  async remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }

  @Get('admin/user/:userId/vendors')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Get all vendors owned by user (Admin only)' })
  @ApiResponse({
    status: 200,
    description:
      'Returns all vendors owned by the specified user, including pending and non-approved vendors',
  })
  async findAllVendorsForUser(@Param('userId') userId: string) {
    return this.vendorService.findAllVendorsForUser(userId);
  }

  @Get('user/:userId/owned')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get vendors owned by user' })
  @ApiResponse({
    status: 200,
    description: 'Returns all vendors owned by the specified user',
  })
  async findVendorsOwnedByUser(
    @Param('userId') userId: string,
    @Request() req,
  ) {
    // Verify the requesting user matches the userId parameter
    if (req.user.id !== userId) {
      throw new UnauthorizedException("Cannot access other users' vendor data");
    }
    return this.vendorService.findVendorsOwnedByUser(userId);
  }
}
