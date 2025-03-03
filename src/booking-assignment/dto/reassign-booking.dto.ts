import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class ReassignBookingDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  newStaffId: string;

  @ApiPropertyOptional({ example: '2025-03-01T09:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  newStartDateTime?: Date;

  @ApiPropertyOptional({ example: 'Schedule conflict resolution' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  requestedById?: string;
}