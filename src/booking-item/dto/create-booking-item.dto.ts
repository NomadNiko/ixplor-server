import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsOptional,
  IsUrl,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments
} from 'class-validator';

@ValidatorConstraint({ name: 'isMultipleOf30', async: false })
export class IsMultipleOf30Constraint implements ValidatorConstraintInterface {
  validate(duration: number, args: ValidationArguments) {
    return duration % 30 === 0;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Duration must be a multiple of 30 minutes';
  }
}

export class CreateBookingItemDto {
  @ApiProperty({ example: 'Beginner Surfing Lesson' })
  @IsString()
  productName: string;

  @ApiProperty({ example: 'Learn the basics of surfing with our experienced instructors' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 'https://example.com/images/surfing-lesson.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ example: 149.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: 120, description: 'Duration in minutes, must be a multiple of 30' })
  @IsNumber()
  @Min(30)
  @Validate(IsMultipleOf30Constraint)
  duration: number;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  vendorId: string;
}