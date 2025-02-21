import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffUserStatusEnum } from '../infrastructure/persistence/document/entities/staff-user.schema';

export class ShiftObjectResponseDto {
  @ApiProperty({ description: 'Start date and time of the shift' })
  startDateTime: string;

  @ApiProperty({ description: 'End date and time of the shift' })
  endDateTime: string;
}

export class BookedObjectResponseDto {
  @ApiProperty({ description: 'ID of the booking item' })
  bookingItemId: string;

  @ApiProperty({ description: 'Start date and time of the booking' })
  startDateTime: string;

  @ApiProperty({ description: 'Duration of the booking in minutes' })
  duration: number;

  @ApiPropertyOptional({ description: 'ID of the transaction associated with this booking' })
  transactionId?: string;

  @ApiPropertyOptional({ description: 'ID of the customer who made the booking' })
  customerId?: string;

  @ApiProperty({ 
    enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
    description: 'Current status of the booking'
  })
  status: string;
}

export class StaffUserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Unique identifier for the staff user' })
  _id: string;

  @ApiProperty({ example: 'John Smith', description: 'Full name of the staff member' })
  name: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the vendor this staff belongs to' })
  vendorId: string;

  @ApiProperty({ 
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of booking item IDs that the staff is qualified to handle'
  })
  qualifiedProducts: string[];

  @ApiProperty({ 
    type: [ShiftObjectResponseDto],
    description: 'Work shifts for the staff member'
  })
  shifts: ShiftObjectResponseDto[];

  @ApiProperty({ 
    type: [BookedObjectResponseDto],
    description: 'Bookings assigned to this staff member'
  })
  bookedObjects: BookedObjectResponseDto[];

  @ApiProperty({ 
    enum: StaffUserStatusEnum,
    description: 'Current status of the staff member'
  })
  status: StaffUserStatusEnum;

  @ApiPropertyOptional({ example: 'john.smith@example.com', description: 'Email address for contact' })
  email?: string;

  @ApiPropertyOptional({ example: '555-123-4567', description: 'Phone number for contact' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Prefers morning shifts', description: 'Additional notes about the staff member' })
  notes?: string;

  @ApiPropertyOptional({ example: 3, description: 'Number of current active bookings' })
  currentWorkload?: number;

  @ApiPropertyOptional({ example: 5, description: 'Number of bookings for the current day' })
  dailyWorkload?: number;

  @ApiPropertyOptional({ example: 4, description: 'Number of booking items this staff is qualified for' })
  qualificationCount?: number;

  @ApiProperty({ description: 'Timestamp when the staff user was created' })
  createdAt: string;

  @ApiProperty({ description: 'Timestamp when the staff user was last updated' })
  updatedAt: string;
}