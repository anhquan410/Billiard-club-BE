/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductPaginationDto } from './dto/product-pagination.dto';
import { join } from 'path';
import * as fs from 'fs';

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
    let oldImageUrl: string | null = null;

    // If new image is uploaded, get current product to find old image
    if (data.imageUrl) {
      const currentProduct = await this.getProductById(id);
      if (!currentProduct) {
        throw new BadRequestException('Product not found');
      }
      oldImageUrl = currentProduct?.imageUrl;
    }

    const updatedProduct = await this.databaseService.product.update({
      where: { id },
      data,
    });

    // Delete old image file if new image was uploaded successfully
    if (data.imageUrl && oldImageUrl && oldImageUrl !== data.imageUrl) {
      this.deleteImageFile(oldImageUrl);
    }

    return updatedProduct;
  }

  // Delete a product by ID
  async deleteProductById(productId: string) {
    // Get product info before deleting to access image URL
    const product = await this.getProductById(productId);

    // Delete product from database
    await this.databaseService.product.delete({
      where: { id: productId },
    });

    // Delete associated image file if exists
    if (product?.imageUrl) {
      this.deleteImageFile(product.imageUrl);
    }
  }

  // Helper method to delete image file
  private deleteImageFile(imageUrl: string): void {
    try {
      // Extract filename from imageUrl (e.g., "/uploads/product-123.jpg" -> "product-123.jpg")
      const filename = imageUrl.split('/').pop();
      if (filename) {
        const filePath = join(process.cwd(), 'uploads', filename);

        // Check if file exists before deleting
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[ProductService] Deleted image file: ${filename}`);
        }
      }
    } catch (error) {
      // Log error but don't throw - we don't want to fail the operation because of file deletion
      console.error('[ProductService] Error deleting image file:', error);
    }
  }
}
