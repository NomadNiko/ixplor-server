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
  Request,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorType } from './infrastructure/persistence/document/entities/vendor.schema';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
  async findByType(@Query('type') type: string) {
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
  async create(@Body() createVendorDto: CreateVendorDto, @Request() req) {
    return this.vendorService.create(createVendorDto, req.user.id);
  }

  @Post(':id/stripe-connect')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update vendor Stripe Connect ID' })
  async updateStripeConnectId(
    @Param('id') id: string,
    @Body() body: { stripeConnectId: string },
  ) {
    return this.vendorService.updateStripeConnectId(id, body.stripeConnectId);
  }

  @Post('admin/approve/:vendorId/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  async approveVendor(
    @Param('vendorId') vendorId: string,
    @Param('userId') userId: string,
  ) {
    return this.vendorService.approveVendor(vendorId, userId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async update(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorService.update(id, updateVendorDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }
}
