// src/staff-schedule/dto/staff-schedule-response.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffScheduleStatusEnum } from '../infrastructure/persistence/document/entities/staff-schedule.schema';

export class StaffScheduleResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  roleId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  staffId: string;
  
  @ApiProperty({ example: '2025-03-01T00:00:00.000Z' })
  date: string;
  
  @ApiProperty({ example: '09:00' })
  startTime: string;
  
  @ApiProperty({ example: '17:00' })
  endTime: string;
  
  @ApiProperty({ enum: StaffScheduleStatusEnum })
  status: StaffScheduleStatusEnum;
  
  @ApiPropertyOptional({ example: 'Training day' })
  notes?: string;
  
  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;
  
  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
}