import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsArray, 
  IsBoolean, 
  IsOptional, 
  Min, 
  Max,
  Matches
} from 'class-validator';

export class CreateRoleShiftDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the role this shift applies to' })
  @IsString()
  roleId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the vendor' })
  @IsString()
  vendorId: string;
  
  @ApiProperty({ example: 1, description: 'Day of week (0-6, Sunday to Saturday)' })
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;
  
  @ApiProperty({ example: '09:00', description: 'Start time in 24-hour format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in 24-hour format (HH:MM)'
  })
  startTime: string;
  
  @ApiProperty({ example: '17:00', description: 'End time in 24-hour format' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in 24-hour format (HH:MM)'
  })
  endTime: string;
  
  @ApiPropertyOptional({ example: 6, description: 'Override default role capacity for this shift' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;
  
  @ApiPropertyOptional({ 
    type: [String], 
    example: ['507f1f77bcf86cd799439011'],
    description: 'Specific booking items applicable for this shift (empty means all qualified items)'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableBookingItems?: string[];
  
  @ApiPropertyOptional({ example: true, default: true, description: 'Whether this shift is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}