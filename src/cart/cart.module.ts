import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartClass, CartSchema } from './entities/cart.schema';
import { ProductModule } from '../products/product.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CartClass.name,
        schema: CartSchema,
      },
    ]),
    ProductModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}