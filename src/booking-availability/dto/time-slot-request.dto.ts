import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDate, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

enum TimePreference {
  ANY = 'ANY',
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  EVENING = 'EVENING'
}

export class TimeSlotRequestDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  bookingItemId: string;

  @ApiProperty({ example: '2025-03-01' })
  @Type(() => Date)
  @IsDate()
  date: Date;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsNumber()
  duration: number;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ enum: TimePreference })
  @IsEnum(TimePreference)
  @IsOptional()
  timePreference?: TimePreference;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  minStaffAvailable?: number;
}

export class TimeSlotResponseDto {
  @ApiProperty({ type: [Date] })
  availableTimeSlots: Date[];

  @ApiProperty({ example: 3 })
  totalSlots: number;

  @ApiProperty({ example: { 'MORNING': 2, 'AFTERNOON': 1 } })
  slotsBreakdown: Record<string, number>;

  @ApiPropertyOptional({ example: ['507f1f77bcf86cd799439011'] })
  availableStaffIds?: string[];
}