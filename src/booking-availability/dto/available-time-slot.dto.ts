import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AvailableTimeSlotDto {
  @ApiProperty({ example: '2025-03-01T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @ApiProperty({ example: '2025-03-01T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @ApiProperty({ example: true })
  @IsBoolean()
  isAvailable: boolean;

  @ApiProperty({ example: 2 })
  @IsNumber()
  availableStaffCount: number;

  @ApiProperty({ example: ['507f1f77bcf86cd799439011'] })
  availableStaffIds: string[];
}