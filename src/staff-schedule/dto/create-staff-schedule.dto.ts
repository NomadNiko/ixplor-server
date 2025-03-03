import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsDate, 
  IsEnum, 
  IsOptional,
  Matches
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffScheduleStatusEnum } from '../infrastructure/persistence/document/entities/staff-schedule.schema';

export class CreateStaffScheduleDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  vendorId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  roleId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  staffId: string;
  
  @ApiProperty({ example: '2025-03-01' })
  @Type(() => Date)
  @IsDate()
  date: Date;
  
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Start time must be in 24-hour format (HH:MM)'
  })
  startTime: string;
  
  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'End time must be in 24-hour format (HH:MM)'
  })
  endTime: string;
  
  @ApiProperty({ enum: StaffScheduleStatusEnum, default: StaffScheduleStatusEnum.DRAFT })
  @IsOptional()
  @IsEnum(StaffScheduleStatusEnum)
  status?: StaffScheduleStatusEnum;
  
  @ApiProperty({ example: 'Training day', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}