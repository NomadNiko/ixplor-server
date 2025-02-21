import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignedStaffDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  staffId: string;

  @ApiProperty({ example: 'John Smith' })
  name: string;

  @ApiProperty({ example: ['Beginner Surfing', 'Intermediate Surfing'] })
  qualifications: string[];

  @ApiProperty({ example: 3 })
  currentBookingsCount: number;

  @ApiProperty({ example: 5 })
  totalBookingsForDay: number;

  @ApiProperty({ example: true })
  isAvailableForReassignment: boolean;

  @ApiPropertyOptional({ example: 'john.smith@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '555-0123' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Prefers morning sessions' })
  notes?: string;

  @ApiProperty({ example: '2025-03-01T08:30:00.000Z' })
  assignedAt: Date;

  @ApiPropertyOptional({ example: 'Auto-assigned based on availability' })
  assignmentReason?: string;
}