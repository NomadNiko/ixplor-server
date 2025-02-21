import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class TimeSlotAvailability {
  @ApiProperty({ example: '2025-03-01T09:00:00.000Z' })
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
  @Type(() => Date)
  endTime: Date;
}

export class AvailableStaffDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  staffId: string;

  @ApiProperty({ example: 'John Smith' })
  name: string;

  @ApiProperty({ type: [TimeSlotAvailability] })
  availableSlots: TimeSlotAvailability[];

  @ApiProperty({ example: true })
  isQualified: boolean;

  @ApiProperty({ example: 3 })
  currentBookings: number;

  @ApiProperty({ example: 5 })
  maxDailyBookings: number;

  @ApiPropertyOptional({ type: [String] })
  qualifications?: string[];

  @ApiPropertyOptional({ example: 'Experienced with beginners' })
  specialties?: string;

  @ApiPropertyOptional({ example: 80 })
  bookingSuccessRate?: number;
}