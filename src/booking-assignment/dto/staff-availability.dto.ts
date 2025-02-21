import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class TimeSlot {
  @ApiProperty({ example: '2025-03-01T09:00:00.000Z' })
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
  @Type(() => Date)
  endTime: Date;
}

export class StaffAvailabilityDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  staffId: string;

  @ApiProperty({ example: 'John Smith' })
  name: string;

  @ApiProperty({ type: [TimeSlot] })
  availableTimeSlots: TimeSlot[];

  @ApiProperty({ example: true })
  qualifiedForBookingItem: boolean;

  @ApiProperty({ example: 3 })
  currentWorkload: number;

  @ApiPropertyOptional({ type: [String] })
  qualifications?: string[];

  @ApiPropertyOptional({ example: 75.5 })
  utilizationRate?: number;
}