import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AddShiftDto {
  @ApiProperty({ 
    example: '2025-03-01T09:00:00.000Z',
    description: 'Start date and time of the shift'
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  startDateTime: Date;

  @ApiProperty({ 
    example: '2025-03-01T17:00:00.000Z',
    description: 'End date and time of the shift'
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  endDateTime: Date;
}