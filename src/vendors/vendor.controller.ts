import { Controller, Get, Query } from '@nestjs/common';
import { VendorService } from './vendor.service';

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  async findAll() {
    return this.vendorService.findAllApproved();
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius?: number
  ) {
    return this.vendorService.findNearby(lat, lng, radius);
  }

  @Get('by-type')
  async findByType(@Query('type') type: string) {
    return this.vendorService.findByType(type);
  }
}