import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CartItemClass } from '../entities/cart.schema';

export class AddToCartDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  productDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productStartTime?: string;
}

export class UpdateCartItemDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CartResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ type: [CartItemClass] })
  items: CartItemClass[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}