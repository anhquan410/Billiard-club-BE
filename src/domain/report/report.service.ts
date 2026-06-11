/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import {
  MovementType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ProductCategory,
  SessionStatus,
} from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { ReportPeriod, ReportQueryDto } from './dto/report-query.dto';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  OTHER: 'Khác',
};


type DecimalLike = Prisma.Decimal | number | string | null | undefined;

@Injectable()
export class ReportService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard(query: ReportQueryDto) {
    const { from, to } = this.parseDateRange(query.fromDate, query.toDate);
    const period = query.period ?? ReportPeriod.MONTH;

    const orderWhere = this.buildOrderWhere(query, from, to);
    const orders = await this.databaseService.order.findMany({
      where: orderWhere,
      include: {
        session: { include: { table: true } },
        items: { include: { product: true } },
      },
    });

    const prevRange = this.getPreviousDateRange(from, to);
    const prevOrders = await this.databaseService.order.findMany({
      where: this.buildOrderWhere(query, prevRange.from, prevRange.to),
      select: { total: true },
    });

    const summary = this.buildSummary(orders, prevOrders);
    const revenueByDay = this.buildRevenueByDay(orders, from, to);
    const revenueByPaymentMethod = this.buildRevenueByPaymentMethod(orders);
    const topProducts = await this.buildTopProducts(query, from, to);
    const tableUsage = await this.buildTableUsage(query, from, to);
    const inventorySummary = await this.buildInventorySummary(from, to);
    const lowStockProducts = await this.buildLowStockProducts();

    return {
      period,
      periodLabel: this.buildPeriodLabel(period, from, to),
      fromDate: query.fromDate,
      toDate: query.toDate,
      summary,
      revenueByDay,
      revenueByPaymentMethod,
      topProducts,
      tableUsage,
      inventorySummary,
      lowStockProducts,
    };
  }

  async exportDashboard(query: ReportQueryDto): Promise<Buffer> {
    const data = await this.getDashboard(query);
    const lines: string[] = [];

    lines.push('BÁO CÁO DOANH THU');
    lines.push(`${data.periodLabel},${data.fromDate},${data.toDate}`);
    lines.push('');
    lines.push('TỔNG QUAN');
    lines.push('Chỉ số,Giá trị');
    lines.push(`Tổng doanh thu,${data.summary.totalRevenue}`);
    lines.push(`Số hóa đơn,${data.summary.totalOrders}`);
    lines.push(`Giá trị TB/hóa đơn,${data.summary.avgOrderValue}`);
    lines.push(`Phiên chơi,${data.summary.tableSessions}`);
    lines.push(`Doanh thu tiền bàn,${data.summary.tableRevenue}`);
    lines.push(`Doanh thu sản phẩm,${data.summary.productRevenue}`);
    lines.push(`Tổng giá vốn,${data.summary.totalCost}`);
    lines.push(`Lợi nhuận gộp,${data.summary.grossProfit}`);
    lines.push('');
    lines.push('DOANH THU THEO NGÀY');
    lines.push('Ngày,Tiền bàn,Sản phẩm,Tổng');
    for (const row of data.revenueByDay) {
      lines.push(
        `${row.date},${row.tableRevenue},${row.productRevenue},${row.total}`,
      );
    }
    lines.push('');
    lines.push('PHƯƠNG THỨC THANH TOÁN');
    lines.push('Phương thức,Số tiền,Số đơn,Tỷ lệ %');
    for (const row of data.revenueByPaymentMethod) {
      lines.push(
        `${row.label},${row.amount},${row.orderCount},${row.percent}`,
      );
    }
    lines.push('');
    lines.push('TOP SẢN PHẨM');
    lines.push('Sản phẩm,Danh mục,SL bán,Doanh thu,Giá vốn,Lợi nhuận');
    for (const row of data.topProducts) {
      lines.push(
        `${this.escapeCsv(row.productName)},${row.category},${row.quantitySold},${row.revenue},${row.cost},${row.profit}`,
      );
    }
    lines.push('');
    lines.push('SỬ DỤNG BÀN');
    lines.push(
      'Bàn,Số phiên,Tổng giờ,Tiền bàn,Doanh thu SP,Tổng DT,Tổng DT sau giảm giá',
    );
    for (const row of data.tableUsage) {
      lines.push(
        `${row.tableName},${row.sessionCount},${row.totalHours},${row.tableFeeRevenue},${row.productRevenue},${row.totalRevenue},${row.totalRevenueAfterDiscount}`,
      );
    }

    const csv = '\uFEFF' + lines.join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  private parseDateRange(fromDate: string, toDate: string) {
    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T23:59:59.999Z`);
    return { from, to };
  }

  private getPreviousDateRange(from: Date, to: Date) {
    const days = this.countDaysInRange(from, to);
    const prevTo = new Date(from);
    prevTo.setUTCDate(prevTo.getUTCDate() - 1);
    prevTo.setUTCHours(23, 59, 59, 999);

    const prevFrom = new Date(prevTo);
    prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
    prevFrom.setUTCHours(0, 0, 0, 0);

    return { from: prevFrom, to: prevTo };
  }

  private countDaysInRange(from: Date, to: Date) {
    const start = Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
    );
    const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  }

  private buildOrderWhere(
    query: ReportQueryDto,
    from: Date,
    to: Date,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      status: OrderStatus.PAID,
      paidAt: { gte: from, lte: to },
    };

    if (query.staffId) {
      where.createdBy = query.staffId;
    }
    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }
    if (query.tableId) {
      where.session = { tableId: query.tableId };
    }

    return where;
  }

  private toNumber(value: DecimalLike): number {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  private getOrderTableRevenue(order: {
    session: { tablePrice: DecimalLike } | null;
  }): number {
    return order.session ? this.toNumber(order.session.tablePrice) : 0;
  }

  private getOrderProductRevenue(order: {
    items: { subtotal: DecimalLike }[];
  }): number {
    return order.items.reduce(
      (sum, item) => sum + this.toNumber(item.subtotal),
      0,
    );
  }

  private getOrderCost(order: {
    items: { quantity: number; product: { costPrice: DecimalLike } }[];
  }): number {
    return order.items.reduce(
      (sum, item) =>
        sum + item.quantity * this.toNumber(item.product.costPrice),
      0,
    );
  }

  private buildSummary(
    orders: {
      total: DecimalLike;
      session: { tablePrice: DecimalLike } | null;
      items: { quantity: number; subtotal: DecimalLike; product: { costPrice: DecimalLike } }[];
    }[],
    prevOrders: { total: DecimalLike }[],
  ) {
    const totalRevenue = orders.reduce(
      (sum, order) => sum + this.toNumber(order.total),
      0,
    );
    const totalOrders = orders.length;
    const tableRevenue = orders.reduce(
      (sum, order) => sum + this.getOrderTableRevenue(order),
      0,
    );
    const productRevenue = orders.reduce(
      (sum, order) => sum + this.getOrderProductRevenue(order),
      0,
    );
    const totalCost = orders.reduce(
      (sum, order) => sum + this.getOrderCost(order),
      0,
    );
    const tableSessions = orders.filter((order) => order.session).length;

    const prevRevenue = prevOrders.reduce(
      (sum, order) => sum + this.toNumber(order.total),
      0,
    );
    const prevOrderCount = prevOrders.length;

    return {
      totalRevenue: Math.round(totalRevenue),
      totalOrders,
      avgOrderValue:
        totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      tableSessions,
      tableRevenue: Math.round(tableRevenue),
      productRevenue: Math.round(productRevenue),
      totalCost: Math.round(totalCost),
      grossProfit: Math.round(totalRevenue - totalCost),
      revenueGrowthPercent: this.calcGrowthPercent(totalRevenue, prevRevenue),
      orderGrowthPercent: this.calcGrowthPercent(totalOrders, prevOrderCount),
    };
  }

  private calcGrowthPercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private buildRevenueByDay(
    orders: {
      paidAt: Date | null;
      session: { tablePrice: DecimalLike } | null;
      items: { subtotal: DecimalLike }[];
    }[],
    from: Date,
    to: Date,
  ) {
    const dayMap = new Map<
      string,
      { tableRevenue: number; productRevenue: number; total: number }
    >();

    for (const order of orders) {
      if (!order.paidAt) continue;
      const key = order.paidAt.toISOString().slice(0, 10);
      const existing = dayMap.get(key) ?? {
        tableRevenue: 0,
        productRevenue: 0,
        total: 0,
      };
      const tableRev = this.getOrderTableRevenue(order);
      const productRev = this.getOrderProductRevenue(order);
      existing.tableRevenue += tableRev;
      existing.productRevenue += productRev;
      existing.total += tableRev + productRev;
      dayMap.set(key, existing);
    }

    const result: {
      date: string;
      tableRevenue: number;
      productRevenue: number;
      total: number;
    }[] = [];

    const cursor = new Date(from);
    while (cursor <= to) {
      const isoKey = cursor.toISOString().slice(0, 10);
      const day = dayMap.get(isoKey) ?? {
        tableRevenue: 0,
        productRevenue: 0,
        total: 0,
      };
      const dd = String(cursor.getUTCDate()).padStart(2, '0');
      const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      result.push({
        date: `${dd}/${mm}`,
        tableRevenue: Math.round(day.tableRevenue),
        productRevenue: Math.round(day.productRevenue),
        total: Math.round(day.total),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  private buildRevenueByPaymentMethod(
    orders: { paymentMethod: PaymentMethod; total: DecimalLike }[],
  ) {
    const map = new Map<
      PaymentMethod,
      { amount: number; orderCount: number }
    >();

    for (const order of orders) {
      const existing = map.get(order.paymentMethod) ?? {
        amount: 0,
        orderCount: 0,
      };
      existing.amount += this.toNumber(order.total);
      existing.orderCount += 1;
      map.set(order.paymentMethod, existing);
    }

    const totalAmount = orders.reduce(
      (sum, order) => sum + this.toNumber(order.total),
      0,
    );

    return Object.values(PaymentMethod).map((method) => {
      const stats = map.get(method) ?? { amount: 0, orderCount: 0 };
      return {
        method,
        label: PAYMENT_METHOD_LABELS[method],
        amount: Math.round(stats.amount),
        orderCount: stats.orderCount,
        percent:
          totalAmount > 0
            ? Math.round((stats.amount / totalAmount) * 1000) / 10
            : 0,
      };
    }).filter((item) => item.amount > 0 || item.orderCount > 0);
  }

  private async buildTopProducts(
    query: ReportQueryDto,
    from: Date,
    to: Date,
  ) {
    const orderWhere = this.buildOrderWhere(query, from, to);
    const items = await this.databaseService.orderItem.findMany({
      where: {
        order: orderWhere,
        ...(query.category && { product: { category: query.category } }),
      },
      include: { product: true },
    });

    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        category: ProductCategory;
        quantitySold: number;
        revenue: number;
        cost: number;
      }
    >();

    for (const item of items) {
      const existing = productMap.get(item.productId) ?? {
        productId: item.productId,
        productName: item.product.name,
        category: item.product.category,
        quantitySold: 0,
        revenue: 0,
        cost: 0,
      };
      existing.quantitySold += item.quantity;
      existing.revenue += this.toNumber(item.subtotal);
      existing.cost +=
        item.quantity * this.toNumber(item.product.costPrice);
      productMap.set(item.productId, existing);
    }

    const limit = query.limit ?? 10;

    return Array.from(productMap.values())
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        quantitySold: item.quantitySold,
        revenue: Math.round(item.revenue),
        cost: Math.round(item.cost),
        profit: Math.round(item.revenue - item.cost),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  private async buildTableUsage(
    query: ReportQueryDto,
    from: Date,
    to: Date,
  ) {
    const sessionWhere: Prisma.TableSessionWhereInput = {
      status: SessionStatus.COMPLETED,
      endTime: { gte: from, lte: to },
    };

    if (query.tableId) {
      sessionWhere.tableId = query.tableId;
    }
    if (query.staffId) {
      sessionWhere.OR = [
        { cashierId: query.staffId },
        { staffId: query.staffId },
      ];
    }

    const sessions = await this.databaseService.tableSession.findMany({
      where: sessionWhere,
      include: {
        table: true,
        services: true,
        order: { select: { total: true } },
      },
    });

    const tableMap = new Map<
      string,
      {
        tableId: string;
        tableName: string;
        sessionCount: number;
        totalMinutes: number;
        tableFeeRevenue: number;
        productRevenue: number;
        totalRevenueAfterDiscount: number;
      }
    >();

    for (const session of sessions) {
      const existing = tableMap.get(session.tableId) ?? {
        tableId: session.tableId,
        tableName: session.table.tableName,
        sessionCount: 0,
        totalMinutes: 0,
        tableFeeRevenue: 0,
        productRevenue: 0,
        totalRevenueAfterDiscount: 0,
      };

      const productRev = session.services.reduce(
        (sum, service) => sum + this.toNumber(service.subtotal),
        0,
      );
      const tableFee = this.toNumber(session.tablePrice);
      const grossTotal = tableFee + productRev;
      const paidTotal = session.order
        ? this.toNumber(session.order.total)
        : grossTotal;

      existing.sessionCount += 1;
      existing.totalMinutes += session.duration ?? 0;
      existing.tableFeeRevenue += tableFee;
      existing.productRevenue += productRev;
      existing.totalRevenueAfterDiscount += paidTotal;
      tableMap.set(session.tableId, existing);
    }

    return Array.from(tableMap.values())
      .map((table) => {
        const totalHours = Math.round((table.totalMinutes / 60) * 10) / 10;
        const totalRevenue = table.tableFeeRevenue + table.productRevenue;

        return {
          tableId: table.tableId,
          tableName: table.tableName,
          sessionCount: table.sessionCount,
          totalHours,
          tableFeeRevenue: Math.round(table.tableFeeRevenue),
          productRevenue: Math.round(table.productRevenue),
          totalRevenue: Math.round(totalRevenue),
          totalRevenueAfterDiscount: Math.round(table.totalRevenueAfterDiscount),
        };
      })
      .sort((a, b) => b.totalRevenueAfterDiscount - a.totalRevenueAfterDiscount);
  }

  private async buildInventorySummary(from: Date, to: Date) {
    const movements = await this.databaseService.stockMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
    });

    let totalImportValue = 0;
    let totalExportValue = 0;
    let importReceiptCount = 0;
    let exportReceiptCount = 0;

    for (const movement of movements) {
      const value = Math.abs(this.toNumber(movement.totalValue));
      if (movement.type === MovementType.IMPORT) {
        totalImportValue += value;
        importReceiptCount += 1;
      } else if (movement.type === MovementType.EXPORT) {
        totalExportValue += value;
        exportReceiptCount += 1;
      }
    }

    const products = await this.databaseService.product.findMany({
      select: { stock: true, minStock: true },
    });

    let lowStockProductCount = 0;
    let outOfStockProductCount = 0;

    for (const product of products) {
      if (product.stock === 0) {
        outOfStockProductCount += 1;
      } else if (product.stock <= product.minStock) {
        lowStockProductCount += 1;
      }
    }

    return {
      totalImportValue: Math.round(totalImportValue),
      totalExportValue: Math.round(totalExportValue),
      importReceiptCount,
      exportReceiptCount,
      lowStockProductCount,
      outOfStockProductCount,
    };
  }

  private async buildLowStockProducts() {
    const lowStock = await this.databaseService.product.findMany({
      orderBy: { stock: 'asc' },
    });

    return lowStock
      .filter((product) => product.stock <= product.minStock)
      .slice(0, 20)
      .map((product) => ({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
      }));
  }

  private buildPeriodLabel(period: ReportPeriod, from: Date, to: Date): string {
    const formatDate = (date: Date) => {
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = date.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    switch (period) {
      case ReportPeriod.TODAY:
        return `Hôm nay (${formatDate(from)})`;
      case ReportPeriod.WEEK:
        return `7 ngày qua (${formatDate(from)} – ${formatDate(to)})`;
      case ReportPeriod.MONTH: {
        const month = from.getUTCMonth() + 1;
        const year = from.getUTCFullYear();
        return `Tháng ${month}/${year}`;
      }
      case ReportPeriod.QUARTER: {
        const quarter = Math.floor(from.getUTCMonth() / 3) + 1;
        const year = from.getUTCFullYear();
        return `Quý ${quarter}/${year}`;
      }
      case ReportPeriod.YEAR:
        return `Năm ${from.getUTCFullYear()}`;
      default:
        return `${formatDate(from)} – ${formatDate(to)}`;
    }
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
