import { Injectable } from '@nestjs/common';
import {
  AccountingTransactionType,
  DebtStatus,
  DebtType,
  MovementType,
  OrderStatus,
  PaymentMethod,
  Prisma,
} from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  MOMO: 'MoMo',
  VNPAY: 'VNPay',
  OTHER: 'Khác',
};

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

@Injectable()
export class AccountingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getDashboard(query: AccountingQueryDto) {
    const { from, to } = this.parseDateRange(query.fromDate, query.toDate);
    const transactions = await this.collectTransactions(from, to, query.type);
    const debts = await this.getDebts();
    const summary = this.buildSummary(transactions, debts);

    return {
      fromDate: query.fromDate,
      toDate: query.toDate,
      summary,
      transactions,
      debts,
    };
  }

  async createTransaction(dto: CreateTransactionDto, userId: string) {
    const code = await this.generateTransactionCode(dto.type);
    const transaction = await this.databaseService.accountingTransaction.create({
      data: {
        code,
        type: dto.type,
        category: dto.category,
        description: dto.description,
        amount: new Prisma.Decimal(dto.amount),
        paymentMethod: dto.paymentMethod,
        createdById: userId,
      },
      include: { createdBy: { select: { fullName: true } } },
    });

    return this.mapManualTransaction(transaction);
  }

  async createDebt(dto: CreateDebtDto) {
    const paidAmount = dto.paidAmount ?? 0;
    const remaining = dto.totalAmount - paidAmount;
    const status = this.resolveDebtStatus(dto.totalAmount, paidAmount, dto.dueDate);

    const debt = await this.databaseService.debt.create({
      data: {
        type: dto.type,
        partnerName: dto.partnerName,
        phone: dto.phone,
        totalAmount: new Prisma.Decimal(dto.totalAmount),
        paidAmount: new Prisma.Decimal(paidAmount),
        dueDate: new Date(`${dto.dueDate}T00:00:00.000Z`),
        status,
        note: dto.note,
      },
    });

    return this.mapDebt(debt);
  }

  private async collectTransactions(
    from: Date,
    to: Date,
    typeFilter?: AccountingTransactionType,
  ) {
    const items: {
      id: string;
      code: string;
      type: AccountingTransactionType;
      category: string;
      description: string;
      amount: number;
      paymentMethod: string;
      createdAt: string;
      createdBy: string;
      sortAt: Date;
    }[] = [];

    if (!typeFilter || typeFilter === AccountingTransactionType.INCOME) {
      const orders = await this.databaseService.order.findMany({
        where: {
          status: OrderStatus.PAID,
          paidAt: { gte: from, lte: to },
        },
        include: {
          session: true,
          items: true,
          customer: { select: { fullName: true } },
        },
      });

      const creators = await this.getUserNameMap(
        orders.map((order) => order.createdBy),
      );

      for (const order of orders) {
        const tableRevenue = order.session
          ? this.toNumber(order.session.tablePrice)
          : 0;
        const productRevenue = order.items.reduce(
          (sum, item) => sum + this.toNumber(item.subtotal),
          0,
        );
        const paidAt = order.paidAt ?? order.createdAt;
        const paymentLabel = PAYMENT_METHOD_LABELS[order.paymentMethod];
        const createdBy: string =
          creators.get(order.createdBy) ?? 'Hệ thống';

        if (tableRevenue > 0) {
          items.push({
            id: `order-table-${order.id}`,
            code: order.orderNumber,
            type: AccountingTransactionType.INCOME,
            category: 'TABLE_REVENUE',
            description: `Thanh toán tiền bàn — ${order.orderNumber}`,
            amount: Math.round(tableRevenue),
            paymentMethod: paymentLabel,
            createdAt: paidAt.toISOString(),
            createdBy,
            sortAt: paidAt,
          });
        }

        if (productRevenue > 0) {
          items.push({
            id: `order-product-${order.id}`,
            code: order.orderNumber,
            type: AccountingTransactionType.INCOME,
            category: 'PRODUCT_SALES',
            description: `Bán sản phẩm — ${order.orderNumber}`,
            amount: Math.round(productRevenue),
            paymentMethod: paymentLabel,
            createdAt: paidAt.toISOString(),
            createdBy,
            sortAt: paidAt,
          });
        }

        if (tableRevenue === 0 && productRevenue === 0) {
          items.push({
            id: `order-${order.id}`,
            code: order.orderNumber,
            type: AccountingTransactionType.INCOME,
            category: 'OTHER',
            description: order.note || `Thanh toán — ${order.orderNumber}`,
            amount: Math.round(this.toNumber(order.total)),
            paymentMethod: paymentLabel,
            createdAt: paidAt.toISOString(),
            createdBy,
            sortAt: paidAt,
          });
        }
      }
    }

    if (!typeFilter || typeFilter === AccountingTransactionType.EXPENSE) {
      const imports = await this.databaseService.stockMovement.findMany({
        where: {
          type: MovementType.IMPORT,
          createdAt: { gte: from, lte: to },
        },
        include: {
          product: { select: { name: true } },
          user: { select: { fullName: true } },
        },
      });

      for (const movement of imports) {
        items.push({
          id: `import-${movement.id}`,
          code: `NK-${movement.id.slice(0, 8).toUpperCase()}`,
          type: AccountingTransactionType.EXPENSE,
          category: 'IMPORT_COST',
          description:
            movement.reason ||
            `Nhập kho ${movement.product.name}`,
          amount: Math.round(Math.abs(this.toNumber(movement.totalValue))),
          paymentMethod: 'Hệ thống',
          createdAt: movement.createdAt.toISOString(),
          createdBy: movement.user.fullName,
          sortAt: movement.createdAt,
        });
      }
    }

    const manualWhere: Prisma.AccountingTransactionWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (typeFilter) {
      manualWhere.type = typeFilter;
    }

    const manual = await this.databaseService.accountingTransaction.findMany({
      where: manualWhere,
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    for (const row of manual) {
      items.push({
        ...this.mapManualTransaction(row),
        sortAt: row.createdAt,
      });
    }

    return items
      .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
      .map(({ sortAt: _sortAt, ...item }) => item);
  }

  private async getDebts() {
    const debts = await this.databaseService.debt.findMany({
      orderBy: { dueDate: 'asc' },
    });

    return debts.map((debt) => this.mapDebt(debt));
  }

  private buildSummary(
    transactions: { type: AccountingTransactionType; amount: number; paymentMethod: string }[],
    debts: { type: DebtType; remainingAmount: number }[],
  ) {
    const totalIncome = transactions
      .filter((item) => item.type === AccountingTransactionType.INCOME)
      .reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = transactions
      .filter((item) => item.type === AccountingTransactionType.EXPENSE)
      .reduce((sum, item) => sum + item.amount, 0);

    const cashIncome = transactions
      .filter(
        (item) =>
          item.type === AccountingTransactionType.INCOME &&
          item.paymentMethod === PAYMENT_METHOD_LABELS.CASH,
      )
      .reduce((sum, item) => sum + item.amount, 0);
    const cashExpense = transactions
      .filter(
        (item) =>
          item.type === AccountingTransactionType.EXPENSE &&
          item.paymentMethod === PAYMENT_METHOD_LABELS.CASH,
      )
      .reduce((sum, item) => sum + item.amount, 0);

    const receivableTotal = debts
      .filter((debt) => debt.type === DebtType.RECEIVABLE)
      .reduce((sum, debt) => sum + debt.remainingAmount, 0);
    const payableTotal = debts
      .filter((debt) => debt.type === DebtType.PAYABLE)
      .reduce((sum, debt) => sum + debt.remainingAmount, 0);

    return {
      totalIncome: Math.round(totalIncome),
      totalExpense: Math.round(totalExpense),
      netProfit: Math.round(totalIncome - totalExpense),
      cashBalance: Math.round(cashIncome - cashExpense),
      receivableTotal: Math.round(receivableTotal),
      payableTotal: Math.round(payableTotal),
      transactionCount: transactions.length,
    };
  }

  private mapManualTransaction(transaction: {
    id: string;
    code: string;
    type: AccountingTransactionType;
    category: string;
    description: string;
    amount: DecimalLike;
    paymentMethod: PaymentMethod;
    createdAt: Date;
    createdBy: { fullName: string };
  }) {
    return {
      id: transaction.id,
      code: transaction.code,
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: Math.round(this.toNumber(transaction.amount)),
      paymentMethod: PAYMENT_METHOD_LABELS[transaction.paymentMethod],
      createdAt: transaction.createdAt.toISOString(),
      createdBy: transaction.createdBy.fullName,
    };
  }

  private mapDebt(debt: {
    id: string;
    type: DebtType;
    partnerName: string;
    phone: string | null;
    totalAmount: DecimalLike;
    paidAmount: DecimalLike;
    dueDate: Date;
    status: DebtStatus;
    note: string | null;
  }) {
    const totalAmount = this.toNumber(debt.totalAmount);
    const paidAmount = this.toNumber(debt.paidAmount);
    return {
      id: debt.id,
      type: debt.type,
      partnerName: debt.partnerName,
      phone: debt.phone ?? undefined,
      totalAmount: Math.round(totalAmount),
      paidAmount: Math.round(paidAmount),
      remainingAmount: Math.round(totalAmount - paidAmount),
      dueDate: debt.dueDate.toISOString().slice(0, 10),
      status: debt.status,
      note: debt.note ?? undefined,
    };
  }

  private resolveDebtStatus(
    totalAmount: number,
    paidAmount: number,
    dueDate: string,
  ): DebtStatus {
    if (paidAmount >= totalAmount) return DebtStatus.PAID;
    if (paidAmount > 0) {
      const due = new Date(`${dueDate}T00:00:00.000Z`);
      return due < new Date() ? DebtStatus.OVERDUE : DebtStatus.PARTIAL;
    }
    const due = new Date(`${dueDate}T00:00:00.000Z`);
    return due < new Date() ? DebtStatus.OVERDUE : DebtStatus.PENDING;
  }

  private async generateTransactionCode(type: AccountingTransactionType) {
    const prefix = type === AccountingTransactionType.INCOME ? 'PT' : 'PC';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.databaseService.accountingTransaction.count({
      where: {
        code: { startsWith: `${prefix}-${today}` },
      },
    });
    return `${prefix}-${today}-${String(count + 1).padStart(3, '0')}`;
  }

  private async getUserNameMap(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    const users = await this.databaseService.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true },
    });
    return new Map<string, string>(
      users.map((user) => [user.id, user.fullName]),
    );
  }

  private parseDateRange(fromDate: string, toDate: string) {
    return {
      from: new Date(`${fromDate}T00:00:00.000Z`),
      to: new Date(`${toDate}T23:59:59.999Z`),
    };
  }

  private toNumber(value: DecimalLike): number {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }
}
