import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExceptionTypeEnum } from '../infrastructure/persistence/document/entities/schedule-exception.schema';

export class ScheduleExceptionResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;
  
  @ApiProperty({ example: '2025-03-01T00:00:00.000Z' })
  date: string;
  
  @ApiProperty({ enum: ExceptionTypeEnum })
  exceptionType: ExceptionTypeEnum;
  
  @ApiProperty({ example: 'Holiday closure' })
  description: string;
  
  @ApiPropertyOptional({ type: [String], example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] })
  affectedRoleIds?: string[];
  
  @ApiPropertyOptional({ type: [String], example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'] })
  affectedBookingItemIds?: string[];
  
  @ApiPropertyOptional({ example: '10:00' })
  modifiedStartTime?: string;
  
  @ApiPropertyOptional({ example: '16:00' })
  modifiedEndTime?: string;
  
  @ApiPropertyOptional({ example: 5 })
  modifiedCapacity?: number;
  
  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;
  
  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
}