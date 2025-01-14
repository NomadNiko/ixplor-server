import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorType } from './infrastructure/persistence/document/entities/vendor.schema';
import { ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Vendors')
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll() {
    return this.vendorService.findAllApproved();
  }

  @Get('nearby')
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radius', type: Number, required: false })
  async findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number
  ) {
    return this.vendorService.findNearby(
      Number(lat),
      Number(lng), 
      radius ? Number(radius) : undefined
    );
  }

  @Get('by-type')
  @ApiQuery({ 
    name: 'type', 
    enum: ['tours', 'lessons', 'rentals', 'tickets'], 
    required: true 
  })
  async findByType(@Query('type') type: string) {
    // Validate that the type is a valid VendorType
    const validTypes: VendorType[] = ['tours', 'lessons', 'rentals', 'tickets'];
    if (!validTypes.includes(type as VendorType)) {
      throw new BadRequestException(`Invalid vendor type. Must be one of: ${validTypes.join(', ')}`);
    }

    return this.vendorService.findByType(type as VendorType);
  }
}