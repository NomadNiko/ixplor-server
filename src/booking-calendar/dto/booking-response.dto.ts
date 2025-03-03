import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatusEnum } from '../infrastructure/persistence/document/entities/booking-calendar.schema';

export class BookingResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  bookingId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  bookingItemId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  roleId: string;
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  staffId?: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  customerId: string;
  
  @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
  startDateTime: string;
  
  @ApiProperty({ example: 60 })
  duration: number;
  
  @ApiProperty({ enum: BookingStatusEnum })
  status: BookingStatusEnum;
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  transactionId?: string;
  
  @ApiPropertyOptional({ example: 'Customer requested morning session' })
  notes?: string;
  
  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;
  
  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
  
  @ApiPropertyOptional({ example: '2025-02-16T10:20:00.000Z' })
  statusUpdatedAt?: string;
}