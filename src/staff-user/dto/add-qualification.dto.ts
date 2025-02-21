import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddQualificationDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'ID of the booking item the staff will be qualified for'
  })
  @IsNotEmpty()
  @IsString()
  bookingItemId: string;
}