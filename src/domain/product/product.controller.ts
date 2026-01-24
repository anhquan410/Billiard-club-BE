import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getAllProducts() {
    const products = await this.productService.getAllProducts();
    return products;
  }

  @Post()
  async createProduct(@Body() data: CreateProductDto) {
    const product = await this.productService.createProduct(data);
    return product;
  }

  // Product Detail

  @Get(':productId')
  async getProductById(@Param('productId') productId: string) {
    const product = await this.productService.getProductById(productId);
    return product;
  }

  @Patch(':productId')
  async updateProductById(
    @Param('productId') productId: string,
    @Body() data: CreateProductDto,
  ) {
    const updatedProduct = await this.productService.updateProductById(
      productId,
      data,
    );
    return updatedProduct;
  }

  @Delete(':productId')
  async deleteProductById(@Param('productId') productId: string) {
    await this.productService.deleteProductById(productId);
  }
}
