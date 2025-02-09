import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartSchemaClass, CartSchema } from './entities/cart.schema';
import { ProductItemModule } from '../product-item/product-item.module';
import { ProductTemplateModule } from '../product-template/product-template.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: CartSchemaClass.name,
        schema: CartSchema,
      },
    ]),
    ProductItemModule,
    ProductTemplateModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}