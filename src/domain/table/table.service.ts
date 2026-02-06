import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, SessionStatus, TableStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class TableService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Lấy tất cả bàn
  async getAllTables() {
    const tables = await this.databaseService.table.findMany({
      orderBy: { tableNumber: 'asc' },
    });
    return tables;
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
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
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

  // Bật bàn (bắt đầu phiên chơi)
  async startSession(tableId: string, staffId: string, note?: string) {
    // 1. Kiểm tra bàn có tồn tại và đang AVAILABLE không
    const table = await this.databaseService.table.findUnique({
      where: { id: tableId },
    });
    if (!table) throw new NotFoundException('Không tìm thấy bàn!');
    if (table.status !== TableStatus.AVAILABLE)
      throw new BadRequestException('Bàn này hiện không sẵn sàng!');

    // 2. Tạo session mới
    const session = await this.databaseService.tableSession.create({
      data: {
        tableId: table.id,
        staffId,
        note,
        startTime: new Date(),
        status: SessionStatus.ACTIVE, // Có thể là enum SessionStatus
      },
    });

    // 3. Lấy thông tin staff (nếu cần)
    const staff = await this.databaseService.user.findUnique({
      where: { id: staffId },
    });
    // 3. Update bàn sang trạng thái OCCUPIED
    await this.databaseService.table.update({
      where: { id: table.id },
      data: { status: TableStatus.OCCUPIED },
    });

    // 4. Trả về session mới và trạng thái bàn hiện tại
    return {
      message: 'Bàn đã được bật & bắt đầu tính giờ',
      sessionId: session.id,
      table: table,
      session,
      staff,
    };
  }

  // Thanh toán & tắt bàn
  async endSession(
    tableId: string,
    body: {
      paymentMethod: PaymentMethod;
      discount?: number;
      note?: string;
      customerId?: string;
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
      include: { services: true, staff: true },
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

    // 5. Tổng hợp tổng tiền, discount, total
    const discount = body.discount ?? 0;
    const subtotal = tablePrice + servicesTotal;
    const total = subtotal - discount;
    const orderNumber = 'HD' + Date.now();

    // 6. Lưu hóa đơn (Order)
    const order = await this.databaseService.order.create({
      data: {
        sessionId: session.id,
        createdBy: session.staffId,
        subtotal: subtotal,
        discount: discount,
        tax: 0, // Nếu có VAT bổ sung sau
        total: total,
        paymentMethod: body.paymentMethod,
        status: 'PAID',
        paidAt: endTime,
        note: body.note ?? '',
        customerId: body.customerId ?? null,
        orderNumber: orderNumber,
      },
    });

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
            createdBy: session.staffId,
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
    };
  }
}
