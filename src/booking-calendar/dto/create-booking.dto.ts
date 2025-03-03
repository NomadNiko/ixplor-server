import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDate,
  IsNumber,
  IsEnum,
  IsOptional,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatusEnum } from '../infrastructure/persistence/document/entities/booking-calendar.schema';

export class CreateBookingDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  bookingItemId: string;
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  roleId?: string;  // Optional: system can auto-assign based on availability
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  staffId?: string;  // Optional: may be assigned later when staff schedules are created
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  vendorId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  customerId: string;
  
  @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDateTime: Date;
  
  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsNumber()
  @Min(1)
  duration: number;
  
  @ApiPropertyOptional({ enum: BookingStatusEnum, default: BookingStatusEnum.PENDING })
  @IsOptional()
  @IsEnum(BookingStatusEnum)
  status?: BookingStatusEnum;
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  transactionId?: string;
  
  @ApiPropertyOptional({ example: 'Customer requested morning session' })
  @IsOptional()
  @IsString()
  notes?: string;
}