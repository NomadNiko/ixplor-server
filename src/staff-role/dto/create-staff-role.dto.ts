import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsArray, 
  IsNumber, 
  IsOptional, 
  IsBoolean,
  Min
} from 'class-validator';

export class CreateStaffRoleDto {
  @ApiProperty({ example: 'Senior Surf Instructor', description: 'Name of the staff role' })
  @IsString()
  name: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the vendor this role belongs to' })
  @IsString()
  vendorId: string;
  
  @ApiPropertyOptional({ 
    type: [String], 
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of booking item IDs this role is qualified to handle'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  qualifiedBookingItems?: string[];
  
  @ApiPropertyOptional({ example: 4, description: 'Default capacity (number of concurrent bookings)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  defaultCapacity?: number;
  
  @ApiPropertyOptional({ example: 'Handles advanced surfing lessons and group sessions' })
  @IsOptional()
  @IsString()
  description?: string;
  
  @ApiPropertyOptional({ example: 'Must have surfing certification and 2+ years experience' })
  @IsOptional()
  @IsString()
  requirements?: string;
  
  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}