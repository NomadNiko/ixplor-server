import { PartialType } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';
import { VendorStatusEnum } from '../infrastructure/persistence/document/entities/vendor.schema';
import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';

export class UpdateVendorDto extends PartialType(CreateVendorDto) {
  @IsOptional()
  @IsEnum(VendorStatusEnum)
  vendorStatus?: VendorStatusEnum;

  @IsOptional()
  @IsString()
  actionNeeded?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ownerIds?: string[];
}