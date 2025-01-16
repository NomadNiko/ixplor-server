import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  ProductSchemaClass, 
  ProductStatusEnum,
  ProductType,
  ProductSchemaDocument
} from './infrastructure/persistence/document/entities/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(ProductSchemaClass.name)
    private readonly productModel: Model<ProductSchemaDocument>
  ) {}

  // Find all products (admin access)
  async findAllProducts() {
    const products = await this.productModel.find()
      .select('-__v')
      .lean()
      .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find only published products (public access)
  async findAllPublished() {
    const products = await this.productModel.find({ 
      productStatus: ProductStatusEnum.PUBLISHED 
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find products by price range
  async findByPriceRange(minPrice: number, maxPrice: number) {
    const products = await this.productModel.find({
      productStatus: ProductStatusEnum.PUBLISHED,
      productPrice: { 
        $gte: minPrice, 
        $lte: maxPrice 
      }
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find products near a location
  async findNearby(lat: number, lng: number, radius: number = 10) {
    if (!lat || !lng) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    const radiusInMeters = radius * 1609.34; // Convert miles to meters
    
    const products = await this.productModel.find({
      productStatus: ProductStatusEnum.PUBLISHED,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          $maxDistance: radiusInMeters
        }
      }
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find products by type (tours, lessons, etc.)
  async findByType(type: ProductType) {
    if (!type) {
      throw new BadRequestException('Product type is required');
    }

    const products = await this.productModel.find({
      productStatus: ProductStatusEnum.PUBLISHED,
      productType: type
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find products by vendor
  async findByVendor(vendorId: string) {
    if (!vendorId) {
      throw new BadRequestException('Vendor ID is required');
    }

    const products = await this.productModel.find({
      vendorId: vendorId
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Find a single product by ID
  async findById(id: string) {
    const product = await this.productModel.findById(id)
      .select('-__v')
      .lean()
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return {
      data: this.transformProductResponse(product)
    };
  }

  // Search products by name or description
  async searchProducts(searchTerm: string) {
    const products = await this.productModel.find({
      productStatus: ProductStatusEnum.PUBLISHED,
      $text: { $search: searchTerm }
    })
    .select('-__v')
    .lean()
    .exec();
    return {
      data: products.map(product => this.transformProductResponse(product))
    };
  }

  // Create a new product
  async create(createProductDto: CreateProductDto) {
    try {
      const createdProduct = new this.productModel({
        ...createProductDto,
        productStatus: ProductStatusEnum.DRAFT
      });
      
      const product = await createdProduct.save();
      return {
        data: this.transformProductResponse(product),
        message: 'Product created successfully'
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // Update an existing product
  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const updatedProduct = await this.productModel.findByIdAndUpdate(
        id,
        { $set: updateProductDto },
        { new: true, runValidators: true }
      ).exec();

      if (!updatedProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      return {
        data: this.transformProductResponse(updatedProduct),
        message: 'Product updated successfully'
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // Update product status
  async updateStatus(id: string, status: ProductStatusEnum) {
    const product = await this.productModel.findByIdAndUpdate(
      id,
      { $set: { productStatus: status } },
      { new: true, runValidators: true }
    ).exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return {
      data: this.transformProductResponse(product),
      message: 'Product status updated successfully'
    };
  }

  // Delete a product
  async remove(id: string) {
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return {
      message: 'Product deleted successfully'
    };
  }

  // Transform product data for response
  private transformProductResponse(product: Record<string, any>) {
    return {
      _id: product._id.toString(),
      productName: product.productName,
      productDescription: product.productDescription,
      productPrice: product.productPrice,
      productType: product.productType,
      location: {
        type: 'Point' as const,
        coordinates: [product.longitude, product.latitude] as [number, number]
      },
      vendorId: product.vendorId,
      productImageURL: product.productImageURL,
      productDuration: product.productDuration,
      productDate: product.productDate,
      productStartTime: product.productStartTime,
      productEndTime: product.productEndTime,
      productAdditionalInfo: product.productAdditionalInfo,
      productRequirements: product.productRequirements,
      productWaiver: product.productWaiver,
      productStatus: product.productStatus,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString()
    };
  }
}