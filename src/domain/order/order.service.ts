/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { BonusService } from '../bonus/bonus.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly bonusService: BonusService,
  ) {}

  // Get all orders
  async getAllOrders() {
    return this.databaseService.order.findMany({
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            membershipTier: true,
          },
        },
        session: {
          include: {
            table: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  /**
   * Tính toán hóa đơn với bonus system
   */
  async calculateOrder(data: CreateOrderDto) {
    const { customerId, subtotal, bonusPointsToUse, useTierDiscount } = data;

    let discountCalculation;

    // Nếu có customer và muốn áp dụng bonus
    if (customerId && (bonusPointsToUse || useTierDiscount)) {
      discountCalculation = await this.bonusService.calculateOrderDiscount(
        customerId,
        subtotal,
        bonusPointsToUse,
        useTierDiscount,
      );
    }

    // Tính tổng tiền cuối cùng
    const baseTotal = subtotal + (data.tax || 0) - (data.discount || 0);
    const bonusDiscount = discountCalculation
      ? discountCalculation.totalDiscount
      : 0;
    const finalTotal = Math.max(0, baseTotal - bonusDiscount);

    // Tính điểm sẽ được tích
    const pointsToEarn = customerId
      ? this.bonusService.calculatePointsFromAmount(finalTotal)
      : 0;

    return {
      subtotal,
      tax: data.tax || 0,
      discount: data.discount || 0,
      bonusDiscount,
      total: finalTotal,
      pointsToEarn,
      discountCalculation,
    };
  }

  /**
   * Tạo hóa đơn mới với bonus system
   */
  async createOrder(data: CreateOrderDto) {
    const orderNumber = await this.generateOrderNumber();

    // Tính toán hóa đơn
    const calculation = await this.calculateOrder(data);

    // Xử lý bonus (nếu có)
    let bonusPointsUsed = 0;
    let discountFromPoints = 0;
    let discountFromTier = 0;

    if (data.customerId && calculation.discountCalculation) {
      bonusPointsUsed = data.bonusPointsToUse || 0;
      discountFromPoints = calculation.discountCalculation.pointsDiscount;
      discountFromTier = calculation.discountCalculation.tierDiscount;

      // Sử dụng điểm (nếu có)
      if (bonusPointsUsed > 0) {
        await this.bonusService.redeemPoints(
          data.customerId,
          'temp', // Sẽ update sau khi tạo order
          bonusPointsUsed,
        );
      }
    }

    // Tạo order trong database
    const order = await this.databaseService.order.create({
      data: {
        orderNumber,
        sessionId: data.sessionId,
        customerId: data.customerId,
        createdBy: data.createdBy,
        subtotal: new Prisma.Decimal(data.subtotal),
        discount: new Prisma.Decimal(data.discount || 0),
        tax: new Prisma.Decimal(data.tax || 0),
        total: new Prisma.Decimal(calculation.total),
        bonusPointsEarned: calculation.pointsToEarn,
        bonusPointsUsed,
        discountFromTier: new Prisma.Decimal(discountFromTier),
        discountFromPoints: new Prisma.Decimal(discountFromPoints),
        paymentMethod: data.paymentMethod,
        status: OrderStatus.PENDING,
        note: data.note,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: new Prisma.Decimal(item.price),
            subtotal: new Prisma.Decimal(item.quantity * item.price),
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            bonusPoints: true,
            membershipTier: true,
          },
        },
      },
    });

    // Update lại orderId trong bonus transaction (nếu đã redeem points)
    if (bonusPointsUsed > 0 && data.customerId) {
      await this.databaseService.bonusTransaction.updateMany({
        where: {
          userId: data.customerId,
          orderId: 'temp',
        },
        data: {
          orderId: order.id,
        },
      });
    }

    return order;
  }

  /**
   * Hoàn thành thanh toán (tích điểm)
   */
  async completePayment(orderId: string) {
    const order = await this.databaseService.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Hóa đơn đã được xử lý');
    }

    // Cập nhật trạng thái đã thanh toán
    const updatedOrder = await this.databaseService.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Tích điểm cho customer (nếu có)
    if (order.customerId && order.bonusPointsEarned > 0) {
      await this.bonusService.earnPoints(
        order.customerId,
        order.id,
        Number(order.total),
      );
    }

    return updatedOrder;
  }

  /**
   * Lấy chi tiết hóa đơn
   */
  async getOrderById(orderId: string) {
    const order = await this.databaseService.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            bonusPoints: true,
            membershipTier: true,
          },
        },
        session: {
          include: {
            table: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }

    return order;
  }

  /**
   * Generate order number
   */
  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await this.databaseService.order.findFirst({
      where: {
        orderNumber: {
          startsWith: `HD${dateStr}`,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
      sequence = lastSequence + 1;
    }

    return `HD${dateStr}${sequence.toString().padStart(3, '0')}`;
  }
}
