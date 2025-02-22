import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsEmail, IsOptional, IsArray } from 'class-validator';
import { StaffUserStatusEnum } from '../infrastructure/persistence/document/entities/staff-user.schema';

export class CreateStaffUserDto {
  @ApiProperty({ example: 'John Smith', description: 'Full name of the staff member' })
  @IsString()
  name: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the vendor this staff belongs to' })
  @IsString()
  vendorId: string;

  @ApiPropertyOptional({ example: 'john.smith@example.com', description: 'Email address for contact' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '555-123-4567', description: 'Phone number for contact' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    enum: StaffUserStatusEnum,
    default: StaffUserStatusEnum.ACTIVE, 
    description: 'Status of the staff member'
  })
  @IsOptional()
  @IsEnum(StaffUserStatusEnum)
  status?: StaffUserStatusEnum;

  @ApiPropertyOptional({ type: [String], description: 'Array of booking item IDs that the staff is qualified for' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifiedProducts?: string[];
}
