import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import {
  ProductSchemaClass,
  ProductSchema,
} from './infrastructure/persistence/document/entities/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ProductSchemaClass.name,
        schema: ProductSchema,
      },
    ]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}