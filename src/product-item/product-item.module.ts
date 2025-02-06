import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductItemController } from './product-item.controller';
import { ProductItemService } from './product-item.service';
import { VendorModule } from '../vendors/vendor.module';
import {
  ProductItemSchemaClass,
  ProductItemSchema,
} from './infrastructure/persistence/document/entities/product-item.schema';
import { ProductTemplateModule } from '../product-template/product-template.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ProductItemSchemaClass.name,
        schema: ProductItemSchema,
      },
    ]),
    VendorModule,
    ProductTemplateModule, // Import ProductTemplateModule to use its service
  ],
  controllers: [ProductItemController],
  providers: [ProductItemService],
  exports: [ProductItemService],
})
export class ProductItemModule {}