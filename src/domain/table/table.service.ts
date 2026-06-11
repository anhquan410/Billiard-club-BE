/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentMethod,
  SessionStatus,
  TableStatus,
} from 'src/prisma';
import { DatabaseService } from 'src/database/database.service';
import { BilliardWebSocketGateway } from 'src/websocket/websocket.gateway';
import { NotificationService } from '../notification/notification.service';
import { BookingService } from '../booking/booking.service';
import { BonusService } from '../bonus/bonus.service';

@Injectable()
export class TableService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly webSocketGateway: BilliardWebSocketGateway,
    private readonly notificationService: NotificationService,
    private readonly bookingService: BookingService,
    private readonly bonusService: BonusService,
  ) {}

  // Lấy tất cả bàn (kèm tên khách & tổng tiền ước tính nếu đang phục vụ)
  async getAllTables() {
    await this.bookingService.releaseExpiredNoShowBookings();

    const tables = await this.databaseService.table.findMany({
      orderBy: { tableNumber: 'asc' },
      include: {
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          take: 1,
          include: {
            customer: { select: { fullName: true } },
            booking: { select: { customerName: true } },
            services: { select: { subtotal: true } },
          },
        },
        bookings: {
          where: { status: BookingStatus.CONFIRMED },
          take: 1,
          select: { customerName: true },
        },
      },
    });

    const now = new Date();

    return tables.map((table) => {
      const session = table.sessions[0];
      let customerName: string | null = null;
      let estimatedTotal: number | null = null;

      if (session) {
        customerName =
          session.customer?.fullName ?? session.booking?.customerName ?? null;

        const durationMins = Math.ceil(
          (now.getTime() - new Date(session.startTime).getTime()) / 60000,
        );
        const tablePrice =
          Math.round(Number(table.hourlyRate) * (durationMins / 60) * 100) /
          100;
        let servicesTotal = 0;
        for (const s of session.services) {
          servicesTotal += Number(s.subtotal);
        }
        estimatedTotal = Math.round((tablePrice + servicesTotal) * 100) / 100;
      } else if (table.status === TableStatus.RESERVED && table.bookings[0]) {
        customerName = table.bookings[0].customerName;
      }

      const { sessions: _sessions, bookings: _bookings, ...rest } = table;

      return {
        ...rest,
        hourlyRate: Number(rest.hourlyRate),
        customerName: customerName ?? undefined,
        estimatedTotal: estimatedTotal ?? undefined,
      };
    });
  }

  // Lấy thông tin bàn theo ID
  async getTableById(tableId: string) {
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');
    return table;
  }

  // Lấy session đang active của bàn
  async getActiveSession(tableId: string) {
    // 1. Kiểm tra bàn có tồn tại không
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');

    // 2. Tìm session đang ACTIVE của bàn này
    const session = await this.databaseService.tableSession.findFirst({
      where: {
        tableId: tableId,
        status: SessionStatus.ACTIVE,
      },
      include: {
        services: {
          include: {
            product: true, // Lấy thông tin sản phẩm nếu có
          },
        },
        cashier: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingCode: true,
            customerId: true,
            customerName: true,
            customerPhone: true,
            startTime: true,
            endTime: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            bonusPoints: true,
            membershipTier: true,
          },
        },
      },
    });

    // 3. Nếu không có session active, trả về null hoặc thông báo
    if (!session) {
      return {
        table,
        session: null,
        message: 'Bàn hiện không có phiên chơi nào đang diễn ra',
      };
    }

    // 4. Tính toán thời gian đã chơi và tiền tạm tính
    const now = new Date();
    const startTime = new Date(session.startTime);
    const durationMins = Math.ceil(
      (now.getTime() - startTime.getTime()) / 60000,
    );
    const hourlyRate = Number(table.hourlyRate);
    const hours = durationMins / 60;
    const currentTablePrice = parseFloat(
      (Math.round(hourlyRate * hours * 100) / 100).toFixed(2),
    );

    // 5. Tính tổng tiền dịch vụ đã sử dụng
    let servicesTotal = 0;
    for (const s of session.services) {
      servicesTotal += Number(s.subtotal);
    }
    servicesTotal = Math.round(servicesTotal * 100) / 100;

    const estimatedTotal = currentTablePrice + servicesTotal;

    return {
      table,
      session,
      durationMins,
      currentTablePrice,
      servicesTotal,
      estimatedTotal,
    };
  }

  // Tính toán tiền thanh toán preview (trước khi thanh toán thật)
  async calculatePayment(tableId: string, discount: number = 0) {
    // 1. Kiểm tra bàn và session đang chơi
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');
    if (table.status !== TableStatus.OCCUPIED)
      throw new BadRequestException('Bàn hiện không có ai chơi!');

    // 2. Lấy session hiện tại
    const session = await this.databaseService.tableSession.findFirst({
      where: {
        tableId: table.id,
        status: SessionStatus.ACTIVE,
      },
      include: { services: true },
    });
    if (!session)
      throw new BadRequestException('Không tìm thấy session đang chơi!');

    const now = new Date();
    const startTime = new Date(session.startTime);

    // 3. TÍNH TIỀN GIỜ CHƠI
    const durationMins = Math.ceil(
      (now.getTime() - startTime.getTime()) / 60000,
    );
    const hourlyRate = Number(table.hourlyRate);
    const hours = durationMins / 60;
    const tablePrice = parseFloat(
      (Math.round(hourlyRate * hours * 100) / 100).toFixed(2),
    );

    // 4. TÍNH TIỀN DỊCH VỤ
    let servicesTotal = 0;
    for (const s of session.services) {
      servicesTotal += Number(s.subtotal);
    }
    servicesTotal = Math.round(servicesTotal * 100) / 100;

    // 5. Tổng hợp tổng tiền, discount, total
    const subtotal = tablePrice + servicesTotal;
    const total = subtotal - discount;

    return {
      tableId: table.id,
      tableNumber: table.tableNumber,
      sessionId: session.id,
      startTime: session.startTime,
      durationMins,
      tablePrice,
      servicesTotal,
      subtotal,
      discount,
      total,
    };
  }

  // Bật bàn (bắt đầu phiên chơi) — walk-in (AVAILABLE) hoặc check-in đặt bàn (RESERVED)
  async startSession(
    tableId: string,
    cashierId: string,
    note?: string,
    bookingId?: string,
  ) {
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');
    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Bàn này đang có khách chơi!');
    }
    if (
      table.status !== TableStatus.AVAILABLE &&
      table.status !== TableStatus.RESERVED
    ) {
      throw new BadRequestException('Bàn này hiện không sẵn sàng!');
    }

    let linkedBookingId: string | null = null;
    let bookingCustomerId: string | null = null;
    let bookingInfo: {
      id: string;
      bookingCode: string;
      customerName: string;
      customerPhone: string;
      startTime: string;
      endTime: string;
    } | null = null;

    if (table.status === TableStatus.RESERVED) {
      const booking = await this.databaseService.tableBooking.findFirst({
        where: {
          tableId: table.id,
          status: BookingStatus.CONFIRMED,
          ...(bookingId ? { id: bookingId } : {}),
        },
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }],
      });

      if (!booking) {
        throw new BadRequestException(
          'Không tìm thấy đặt bàn đã xác nhận cho bàn này. Vui lòng kiểm tra lại.',
        );
      }

      linkedBookingId = booking.id;
      bookingCustomerId = booking.customerId;
      bookingInfo = {
        id: booking.id,
        bookingCode: booking.bookingCode,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        startTime: booking.startTime,
        endTime: booking.endTime,
      };
    }

    const cashier = await this.databaseService.user.findUnique({
      where: { id: cashierId },
    });
    if (!cashier) {
      throw new BadRequestException('Không tìm thấy thông tin thu ngân!');
    }

    const session = await this.databaseService.tableSession.create({
      data: {
        tableId: table.id,
        bookingId: linkedBookingId,
        customerId: bookingCustomerId,
        cashierId,
        note,
        startTime: new Date(),
        status: SessionStatus.ACTIVE,
      },
    });

    // 3. Update bàn sang trạng thái OCCUPIED
    await this.databaseService.table.update({
      where: { id: table.id },
      data: { status: TableStatus.OCCUPIED },
    });

    // 4. Gửi thông báo
    await this.notificationService.sendTableStartedNotification({
      tableId: table.id,
      tableNumber: table.tableNumber,
    });

    if (linkedBookingId) {
      const linkedBooking = await this.databaseService.tableBooking.findUnique({
        where: { id: linkedBookingId },
        include: { table: true },
      });
      if (linkedBooking) {
        await this.notificationService.sendBookingCheckInNotification(
          linkedBooking,
          table.tableName,
        );
      }
    }

    // 5. Emit WebSocket event - bàn đã được bật
    this.webSocketGateway.emitTableStarted({
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: TableStatus.OCCUPIED,
      sessionId: session.id,
    });

    return {
      message: linkedBookingId
        ? 'Check-in đặt bàn thành công, bắt đầu tính giờ'
        : 'Bàn đã được bật & bắt đầu tính giờ',
      sessionId: session.id,
      table: { ...table, status: TableStatus.OCCUPIED },
      session: { ...session, booking: bookingInfo },
      bookingCustomerId,
      checkedInFromBooking: !!linkedBookingId,
    };
  }

  // Gắn khách hàng vào phiên chơi đang active
  async assignCustomer(sessionId: string, customerId: string | null) {
    const session = await this.databaseService.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session không hợp lệ hoặc đã kết thúc!');
    }

    if (customerId) {
      const customer = await this.databaseService.user.findFirst({
        where: { id: customerId, role: 'CUSTOMER', status: 'ACTIVE' },
      });
      if (!customer) {
        throw new BadRequestException('Không tìm thấy khách hàng!');
      }
    }

    return this.databaseService.tableSession.update({
      where: { id: sessionId },
      data: { customerId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            bonusPoints: true,
            membershipTier: true,
          },
        },
      },
    });
  }

  // Gắn nhân viên phục vụ vào phiên chơi (Admin hoặc Cashier đều làm được)
  async assignStaff(sessionId: string, staffId: string | null) {
    const session = await this.databaseService.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== 'ACTIVE')
      throw new BadRequestException('Session không hợp lệ hoặc đã kết thúc!');

    if (staffId) {
      const staff = await this.databaseService.user.findUnique({
        where: { id: staffId },
      });
      if (!staff) throw new BadRequestException('Nhân viên không tồn tại!');
    }

    return this.databaseService.tableSession.update({
      where: { id: sessionId },
      data: { staffId },
      include: {
        cashier: { select: { id: true, fullName: true, role: true } },
        staff: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  // Thay đổi cashier gắn với phiên chơi (Chỉ Admin mới làm được)
  async changeCashier(sessionId: string, cashierId: string) {
    const session = await this.databaseService.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== 'ACTIVE')
      throw new BadRequestException('Session không hợp lệ hoặc đã kết thúc!');

    const cashier = await this.databaseService.user.findUnique({
      where: { id: cashierId },
    });
    if (!cashier || (cashier.role !== 'CASHIER' && cashier.role !== 'ADMIN'))
      throw new BadRequestException(
        'Người dùng phải có role CASHIER hoặc ADMIN!',
      );

    return this.databaseService.tableSession.update({
      where: { id: sessionId },
      data: { cashierId },
      include: {
        cashier: { select: { id: true, fullName: true, role: true } },
        staff: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  // Thanh toán & tắt bàn
  async endSession(
    tableId: string,
    userId: string,
    body: {
      paymentMethod: PaymentMethod;
      discount?: number;
      note?: string;
      customerId?: string;
      bonusPointsToUse?: number;
      useTierDiscount?: boolean;
    },
  ) {
    // 1. Kiểm tra bàn và session “đang chơi” (ACTIVE)
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');
    if (table.status !== TableStatus.OCCUPIED)
      throw new BadRequestException('Bàn hiện không có ai chơi!');

    // 2. Lấy session hiện tại
    const session = await this.databaseService.tableSession.findFirst({
      where: {
        tableId: table.id,
        status: SessionStatus.ACTIVE, // Chỉ session đang chơi
      },
      include: {
        services: true,
        staff: true,
        booking: {
          select: {
            id: true,
            customerId: true,
            bookingCode: true,
            customerName: true,
            customerPhone: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });
    if (!session)
      throw new BadRequestException('Không tìm thấy session đang chơi!');

    const endTime = new Date();
    const startTime = new Date(session.startTime);

    // 3. TÍNH TIỀN GIỜ CHƠI
    const durationMins = Math.ceil(
      (endTime.getTime() - startTime.getTime()) / 60000,
    );
    const hourlyRate = Number(table.hourlyRate);
    const hours = durationMins / 60;
    const tablePrice = parseFloat(
      (Math.round(hourlyRate * hours * 100) / 100).toFixed(2),
    );

    // 4. TÍNH TIỀN DỊCH VỤ
    let servicesTotal = 0;
    for (const s of session.services) {
      servicesTotal += Number(s.subtotal);
    }
    servicesTotal = Math.round(servicesTotal * 100) / 100;

    // 5. Tổng hợp tổng tiền, giảm giá thủ công + bonus
    const manualDiscount = body.discount ?? 0;
    const subtotal = tablePrice + servicesTotal;
    const amountBeforeBonus = Math.max(0, subtotal - manualDiscount);
    const orderNumber = 'HD' + Date.now();

    const orderCustomerId =
      body.customerId ??
      session.customerId ??
      session.booking?.customerId ??
      null;

    let bonusPointsUsed = 0;
    let discountFromPoints = 0;
    let discountFromTier = 0;
    let bonusPointsEarned = 0;

    if (orderCustomerId) {
      const pointsToUse = body.bonusPointsToUse ?? 0;
      const useTierDiscount = body.useTierDiscount ?? true;

      if (pointsToUse > 0 || useTierDiscount) {
        const discountCalc = await this.bonusService.calculateOrderDiscount(
          orderCustomerId,
          amountBeforeBonus,
          pointsToUse > 0 ? pointsToUse : undefined,
          useTierDiscount && pointsToUse === 0,
        );

        discountFromPoints = discountCalc.pointsDiscount;
        discountFromTier = discountCalc.tierDiscount;
        bonusPointsUsed = pointsToUse > 0 ? pointsToUse : 0;
      }

      bonusPointsEarned = await this.bonusService.calculatePointsFromAmount(
        Math.max(0, amountBeforeBonus - discountFromPoints - discountFromTier),
      );
    }

    const total = Math.max(
      0,
      amountBeforeBonus - discountFromPoints - discountFromTier,
    );

    const order = await this.databaseService.order.create({
      data: {
        sessionId: session.id,
        createdBy: userId,
        subtotal: subtotal,
        discount: manualDiscount,
        tax: 0,
        total: total,
        paymentMethod: body.paymentMethod,
        status: 'PAID',
        paidAt: endTime,
        note: body.note ?? '',
        customerId: orderCustomerId,
        orderNumber: orderNumber,
        bonusPointsUsed,
        bonusPointsEarned,
        discountFromPoints,
        discountFromTier,
      },
    });

    if (orderCustomerId && bonusPointsUsed > 0) {
      await this.bonusService.redeemPoints(
        orderCustomerId,
        order.id,
        bonusPointsUsed,
        amountBeforeBonus,
      );
    }

    if (orderCustomerId) {
      await this.bonusService.earnPoints(orderCustomerId, order.id, total);
    }

    // 6.1. Tạo OrderItem từ TableSessionService
    if (session.services && session.services.length > 0) {
      const orderItems = session.services.map((service) => ({
        orderId: order.id,
        productId: service.productId,
        quantity: service.quantity,
        price: service.price,
        subtotal: service.subtotal,
      }));

      await this.databaseService.orderItem.createMany({
        data: orderItems,
      });
    }

    // 7. Hoàn thành session + update Table trả trạng thái AVAILABLE
    await this.databaseService.tableSession.update({
      where: { id: session.id },
      data: {
        endTime,
        duration: durationMins,
        tablePrice: tablePrice,
        totalPrice: subtotal,
        status: 'COMPLETED',
      },
    });
    await this.databaseService.table.update({
      where: { id: table.id },
      data: { status: 'AVAILABLE' },
    });

    if (session.bookingId) {
      await this.databaseService.tableBooking.update({
        where: { id: session.bookingId },
        data: { status: BookingStatus.COMPLETED },
      });
    }

    // 8. Emit WebSocket event - bàn đã được tắt
    this.webSocketGateway.emitTableEnded({
      tableId: table.id,
      tableNumber: table.tableNumber,
      status: TableStatus.AVAILABLE,
    });

    const customerName =
      session.customer?.fullName ?? session.booking?.customerName ?? undefined;

    await this.notificationService.sendTablePaymentNotification({
      tableId: table.id,
      tableName: table.tableName,
      tableNumber: table.tableNumber,
      total,
      durationMins,
      orderNumber,
      customerId: orderCustomerId,
      customerPhone: session.customer?.phone ?? session.booking?.customerPhone,
      customerName,
    });

    // Sau khi cập nhật hóa đơn, session, table
    // Lấy danh sách các dịch vụ đã sử dụng trong phiên chơi
    const services = await this.databaseService.tableSessionService.findMany({
      where: { sessionId: session.id },
    });

    for (const service of services) {
      if (service.productId) {
        // Lấy tồn kho hiện tại trước khi trừ
        const product = await this.databaseService.product.findUnique({
          where: { id: service.productId },
          select: { stock: true },
        });
        if (!product) {
          throw new NotFoundException(
            `Không tìm thấy sản phẩm với id: ${service.productId}`,
          );
        }
        const beforeStock = product.stock;
        const afterStock = beforeStock - service.quantity;

        // Giảm số lượng kho sản phẩm tương ứng
        await this.databaseService.product.update({
          where: { id: service.productId },
          data: {
            stock: {
              decrement: service.quantity,
            },
          },
        });

        // Nếu có bảng StockMovement, lưu log xuất kho
        await this.databaseService.stockMovement.create({
          data: {
            productId: service.productId,
            type: 'EXPORT',
            quantity: -service.quantity,
            beforeStock: beforeStock,
            afterStock: afterStock,
            unitPrice: service.price,
            totalValue: Number(service.quantity) * Number(service.price),
            reason: 'Bán sản phẩm qua bàn chơi',
            createdBy: userId,
          },
        });
      }
    }

    return {
      message: 'Thanh toán thành công, bàn đã được tắt!',
      order,
      tableId: table.id,
      durationMins,
      tablePrice,
      servicesTotal,
      total,
      bonusPointsEarned,
      discountFromTier,
      discountFromPoints,
    };
  }
}
