import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsEnum, 
  IsDate, 
  IsArray, 
  IsNumber,
  IsOptional, 
  IsNotEmpty,
  Matches
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExceptionTypeEnum } from '../infrastructure/persistence/document/entities/schedule-exception.schema';

export class CreateScheduleExceptionDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  vendorId: string;
  
  @ApiProperty({ example: '2025-03-01' })
  @Type(() => Date)
  @IsDate()
  date: Date;
  
  @ApiProperty({ enum: ExceptionTypeEnum })
  @IsEnum(ExceptionTypeEnum)
  exceptionType: ExceptionTypeEnum;
  
  @ApiProperty({ example: 'Holiday closure' })
  @IsString()
  description: string;
  
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedRoleIds?: string[];
  
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedBookingItemIds?: string[];
  
  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in 24-hour format (HH:MM)'
  })
  modifiedStartTime?: string;
  
  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in 24-hour format (HH:MM)'
  })
  modifiedEndTime?: string;
  
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  modifiedCapacity?: number;
}