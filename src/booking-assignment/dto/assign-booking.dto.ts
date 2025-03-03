import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDate, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignBookingDto {
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

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  staffId?: string;  // Optional because system might auto-assign

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;
}