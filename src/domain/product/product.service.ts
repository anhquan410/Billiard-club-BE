/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductPaginationDto } from './dto/product-pagination.dto';

@Injectable()
export class ProductService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Get all products
  async getAllProducts() {
    const products = await this.databaseService.product.findMany();
    return products;
  }

  // Paginate products
  async paginate(query: ProductPaginationDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { category } = query;

    // Xây where filter động
    const whereClause: any = {};

    if (category) {
      whereClause.category = category;
    }

    const [items, total] = await Promise.all([
      this.databaseService.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { category: 'desc' }, // pagination stable
        where: whereClause,
      }),
      this.databaseService.product.count({ where: whereClause }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Create a new product
  async createProduct(data: CreateProductDto) {
    const isExisting = await this.databaseService.product.findUnique({
      where: { name: data.name },
    });
    if (isExisting) {
      throw new BadRequestException(
        'Product with the same name already exists',
      );
    }
    const newProduct = await this.databaseService.product.create({
      data,
    });
    return newProduct;
  }
  // Product Detail

  // Get a product by ID
  async getProductById(id: string) {
    const product = await this.databaseService.product.findUnique({
      where: { id },
    });
    return product;
  }

  // Update a product by ID
  async updateProductById(id: string, data: CreateProductDto) {
    const updatedProduct = await this.databaseService.product.update({
      where: { id },
      data,
    });
    return updatedProduct;
  }

  // Delete a product by ID
  async deleteProductById(productId: string) {
    await this.databaseService.product.delete({
      where: { id: productId },
    });
  }
}
