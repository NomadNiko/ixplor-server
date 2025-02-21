import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingItemStatusEnum } from '../infrastructure/persistence/document/entities/booking-item.schema';

export class BookingItemResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: 'Beginner Surfing Lesson' })
  productName: string;

  @ApiProperty({ example: 'Learn the basics of surfing with our experienced instructors' })
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/surfing-lesson.jpg' })
  imageUrl?: string;

  @ApiProperty({ example: 149.99 })
  price: number;

  @ApiProperty({ example: 120 })
  duration: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;

  @ApiProperty({ enum: BookingItemStatusEnum })
  status: BookingItemStatusEnum;

  @ApiProperty({ example: '2025-02-15T08:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2025-02-16T10:15:00.000Z' })
  updatedAt: string;
}