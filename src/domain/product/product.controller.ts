import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductPaginationDto } from './dto/product-pagination.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Get all products
  @Get('/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể xem danh sách sản phẩm
  async getAllProducts() {
    const products = await this.productService.getAllProducts();
    return products;
  }

  // Paginate products
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể phân trang sản phẩm
  async findProductPagination(@Query() query: ProductPaginationDto) {
    return this.productService.paginate(query);
  }

  // Create a new product
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN được tạo sản phẩm
  async createProduct(@Body() data: CreateProductDto) {
    const product = await this.productService.createProduct(data);
    return product;
  }

  // Product Detail

  @Get(':productId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF') // ADMIN và STAFF đều có thể xem chi tiết sản phẩm
  async getProductById(@Param('productId') productId: string) {
    const product = await this.productService.getProductById(productId);
    return product;
  }

  @Patch(':productId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN được cập nhật sản phẩm
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
  @UseGuards(RolesGuard)
  @Roles('ADMIN') // Chỉ ADMIN được xóa sản phẩm
  async deleteProductById(@Param('productId') productId: string) {
    await this.productService.deleteProductById(productId);
  }
}
