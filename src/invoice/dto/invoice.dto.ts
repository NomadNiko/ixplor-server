import { ApiProperty } from '@nestjs/swagger';

export class InvoiceItemDto {
  @ApiProperty({ example: '67a595d60c52dd570aa42f5b' })
  productItemId: string;

  @ApiProperty({ example: 'Nightly Beach Walk' })
  productName: string;

  @ApiProperty({ example: 42.00 })
  price: number;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: '2025-02-11T00:00:00.000Z' })
  productDate: string;

  @ApiProperty({ example: '14:00' })
  productStartTime: string;

  @ApiProperty({ example: 60 })
  productDuration: number;
}

export class InvoiceResponseDto {
  @ApiProperty({ example: '67a9c06a2326aeb6e228babb' })
  _id: string;

  @ApiProperty({ example: 'cs_test_b1TpfvUsp3K6vqqAcCbNlcq2aXGkQlM76Kp9sogqu6ohnseqwJkEETydDV' })
  stripeCheckoutSessionId: string;

  @ApiProperty({ example: 203.00 })
  amount: number;

  @ApiProperty({ example: 'usd' })
  currency: string;

  @ApiProperty({ example: '67a56b620c52dd570aa42e3d' })
  vendorId: string;

  @ApiProperty({ example: '67a56af00c52dd570aa42e31' })
  customerId: string;

  @ApiProperty({ type: [String], example: ['67a595d60c52dd570aa42f5b'] })
  productItemIds: string[];

  @ApiProperty({ example: 'succeeded' })
  status: string;

  @ApiProperty({ example: 'payment' })
  type: string;

  @ApiProperty({ example: 'Payment for 5 item(s)' })
  description: string;
}