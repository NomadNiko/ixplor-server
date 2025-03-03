import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingDetailsDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  bookingId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  bookingItemId: string;

  @ApiProperty({ example: 'Beginner Surfing Lesson' })
  bookingItemName: string;

  @ApiProperty({ example: '2025-03-01T09:00:00.000Z' })
  startDateTime: Date;

  @ApiProperty({ example: 60 })
  duration: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  customerId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  staffId: string;

  @ApiProperty({ example: 'John Smith' })
  staffName: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  transactionId?: string;

  @ApiPropertyOptional({ example: 'Customer requested morning session' })
  notes?: string;

  @ApiProperty({ example: '2025-03-01T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-03-01T08:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2025-03-01T08:35:00.000Z' })
  lastStatusChange?: Date;

  @ApiPropertyOptional({ example: 'Staff requested time change' })
  lastStatusChangeReason?: string;
  
  // Added properties needed for cart integration
  @ApiPropertyOptional({ example: 149.99 })
  price?: number;
  
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  vendorId?: string;
}