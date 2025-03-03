import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleShiftResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  roleId: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;
  
  @ApiProperty({ example: 1, description: 'Day of week (0-6, Sunday to Saturday)' })
  dayOfWeek: number;
  
  @ApiProperty({ example: '09:00' })
  startTime: string;
  
  @ApiProperty({ example: '17:00' })
  endTime: string;
  
  @ApiPropertyOptional({ example: 6 })
  capacity?: number;
  
  @ApiProperty({ 
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
  })
  applicableBookingItems: string[];
  
  @ApiProperty({ example: true })
  isActive: boolean;
  
  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;
  
  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
}