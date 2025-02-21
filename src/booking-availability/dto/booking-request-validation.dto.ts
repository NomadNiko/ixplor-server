import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDate, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingRequestValidationDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  bookingItemId: string;

  @ApiProperty({ example: '2025-03-01T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startDateTime: Date;

  @ApiProperty({ example: 60, description: 'Duration in minutes' })
  @IsNumber()
  duration: number;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  preferredStaffId?: string;

  @ApiPropertyOptional({ example: 'MORNING', description: 'Preferred time of day' })
  @IsString()
  @IsOptional()
  timePreference?: string;
}

export class BookingValidationResponseDto {
  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiProperty({ example: 2 })
  availableStaffCount: number;

  @ApiProperty({ example: ['507f1f77bcf86cd799439011'] })
  availableStaffIds: string[];

  @ApiPropertyOptional({ example: 'No qualified staff available at requested time' })
  reason?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Alternative available time slots' })
  alternativeTimeSlots?: Date[];
}