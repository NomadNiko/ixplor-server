import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { PaymentStatus } from '../infrastructure/persistence/document/entities/payment.schema';

export class CreatePaymentDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  ticketId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  transactionId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  vendorId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  customerId: string;

  @ApiProperty({ example: 85.00 })
  @IsNumber()
  payoutAmount: number;

  @ApiProperty({ example: 100.00 })
  @IsNumber()
  originalAmount: number;

  @ApiProperty({ example: 15.00 })
  @IsNumber()
  applicationFee: number;
}

export class UpdatePaymentDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  payoutSent?: boolean;
}

export class PaymentResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  _id: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  ticketId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  transactionId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  vendorId: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  customerId: string;

  @ApiProperty({ example: 85.00 })
  payoutAmount: number;

  @ApiProperty({ example: 100.00 })
  originalAmount: number;

  @ApiProperty({ example: 15.00 })
  applicationFee: number;

  @ApiProperty({ example: false })
  payoutSent: boolean;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}