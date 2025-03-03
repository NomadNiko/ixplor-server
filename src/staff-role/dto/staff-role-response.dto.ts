import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StaffRoleResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;
  
  @ApiProperty({ example: 'Senior Surf Instructor' })
  name: string;
  
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;
  
  @ApiProperty({ 
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
  })
  qualifiedBookingItems: string[];
  
  @ApiProperty({ example: 4 })
  defaultCapacity: number;
  
  @ApiPropertyOptional({ example: 'Handles advanced surfing lessons and group sessions' })
  description?: string;
  
  @ApiPropertyOptional({ example: 'Must have surfing certification and 2+ years experience' })
  requirements?: string;
  
  @ApiProperty({ example: true })
  isActive: boolean;
  
  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;
  
  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
}