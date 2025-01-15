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
  async create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorService.create(createVendorDto);
  }

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
    @Body() updateData: any // We'll define proper DTO later
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
}
