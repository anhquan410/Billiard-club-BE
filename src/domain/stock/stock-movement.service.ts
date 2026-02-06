import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { StockMovementPaginationDto } from './dto/stock-movement-pagination.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class StockMovementService {
  // Define your service methods here
  constructor(private readonly databaseService: DatabaseService) {}

  // get all stock items with pagination
  async getAllStockItems(query: StockMovementPaginationDto) {
    const { page = 1, limit = 10, type, productId, search } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.StockMovementWhereInput = {};
    if (type) where.type = type;
    if (productId) where.productId = productId;
    if (search) {
      where.OR = [
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [stockItems, total] = await Promise.all([
      this.databaseService.stockMovement.findMany({
        where,
        include: {
          product: true,
          user: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.stockMovement.count({ where }),
    ]);

    return {
      stockItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // get export-stock items with pagination
  async getExportStockItems(query: StockMovementPaginationDto) {
    return this.getAllStockItems({ ...query, type: 'EXPORT' });
  }

  // get import-stock items with pagination
  async getImportStockItems(query: StockMovementPaginationDto) {
    return this.getAllStockItems({ ...query, type: 'IMPORT' });
  }

  // import stock - nhập hàng
  async importStock(
    productId: string,
    quantity: number,
    unitPrice: number,
    staffId: string,
    reason?: string,
  ) {
    // 1. Kiểm tra sản phẩm có tồn tại không
    const product = await this.databaseService.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm!');
    }

    const beforeStock = Number(product.stock);
    const afterStock = beforeStock + quantity;
    const totalValue = quantity * unitPrice;
    const newCostPrice =
      (Number(product.costPrice) * beforeStock + totalValue) / afterStock;

    // 2. Thực hiện transaction để đảm bảo tính nhất quán
    const result = await this.databaseService.$transaction(async (tx) => {
      // 2.1. Cập nhật tồn kho sản phẩm
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          stock: afterStock,
          costPrice: newCostPrice, // Cập nhật giá vốn mới
        },
      });

      // 2.2. Tạo phiếu nhập kho (StockMovement)
      const stockMovement = await tx.stockMovement.create({
        data: {
          productId,
          type: 'IMPORT',
          quantity,
          beforeStock,
          afterStock,
          unitPrice,
          totalValue,
          reason: reason || 'Nhập hàng',
          createdBy: staffId,
        },
        include: {
          product: true,
          user: { select: { fullName: true, email: true } },
        },
      });

      return { stockMovement, updatedProduct };
    });

    return result;
  }
}
