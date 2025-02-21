import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsEmail, 
  IsOptional, 
  IsArray,
  ValidateNested,
  ArrayMinSize
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffUserStatusEnum } from '../infrastructure/persistence/document/entities/staff-user.schema';
import { AddShiftDto } from './add-shift.dto';

export class CreateStaffUserDto {
  @ApiProperty({ example: 'John Smith', description: 'Full name of the staff member' })
  @IsString()
  name: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the vendor this staff belongs to' })
  @IsString()
  vendorId: string;

  @ApiProperty({ 
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of booking item IDs that the staff is qualified to handle'
  })
  @IsArray()
  @IsString({ each: true })
  qualifiedProducts: string[];

  @ApiPropertyOptional({ 
    type: [AddShiftDto],
    description: 'Initial work shifts for the staff member'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddShiftDto)
  shifts?: AddShiftDto[];

  @ApiPropertyOptional({ 
    enum: StaffUserStatusEnum,
    default: StaffUserStatusEnum.ACTIVE, 
    description: 'Status of the staff member'
  })
  @IsOptional()
  @IsEnum(StaffUserStatusEnum)
  status?: StaffUserStatusEnum;

  @ApiPropertyOptional({ example: 'john.smith@example.com', description: 'Email address for contact' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '555-123-4567', description: 'Phone number for contact' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Prefers morning shifts', description: 'Additional notes about the staff member' })
  @IsOptional()
  @IsString()
  notes?: string;
}