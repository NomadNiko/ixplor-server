import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsOptional,
  IsUrl,
  Min,
  IsEnum,
  Validate
} from 'class-validator';
import { BookingItemStatusEnum } from '../infrastructure/persistence/document/entities/booking-item.schema';
import { IsMultipleOf30Constraint } from './create-booking-item.dto';

export class UpdateBookingItemDto {
  @ApiPropertyOptional({ example: 'Advanced Surfing Lesson' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ example: 'Perfect your surfing technique with advanced methods' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/advanced-surfing.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 199.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 90, description: 'Duration in minutes, must be a multiple of 30' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Validate(IsMultipleOf30Constraint)
  duration?: number;

  @ApiPropertyOptional({ enum: BookingItemStatusEnum })
  @IsOptional()
  @IsEnum(BookingItemStatusEnum)
  status?: BookingItemStatusEnum;
}