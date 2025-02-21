import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimeSlotDto {
  @ApiProperty({ example: 9, description: 'Hour of the day (0-23)' })
  hour: number;

  @ApiProperty({ example: true, description: 'Whether this time slot is booked' })
  isBooked: boolean;

  @ApiPropertyOptional({ 
    example: '507f1f77bcf86cd799439011', 
    description: 'ID of the booking if this slot is booked'
  })
  bookingId?: string;
}

export class StaffWorkloadDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the staff member' })
  staffId: string;

  @ApiProperty({ example: '2025-03-01T00:00:00.000Z', description: 'Date for which workload is calculated' })
  date: Date;

  @ApiProperty({ example: 8, description: 'Total number of bookings for this date' })
  totalBookings: number;

  @ApiProperty({ example: 3, description: 'Number of completed bookings' })
  completedBookings: number;

  @ApiProperty({ example: 5, description: 'Number of pending/confirmed bookings' })
  pendingBookings: number;

  @ApiProperty({ 
    example: 75.5, 
    description: 'Percentage of shift time that is booked (0-100)'
  })
  utilizationRate: number;

  @ApiProperty({ 
    type: [TimeSlotDto],
    description: 'Hourly breakdown of the day showing booked/free status'
  })
  timeSlots: TimeSlotDto[];
}