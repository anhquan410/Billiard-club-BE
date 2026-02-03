import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class TableSessionService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Thêm dịch vụ vào phiên chơi
  async addService(
    sessionId: string,
    productId: string,
    quantity: number = 1,
    price?: number,
  ) {
    // Kiểm tra session có tồn tại và đang ACTIVE
    const session = await this.databaseService.tableSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.status !== 'ACTIVE')
      throw new BadRequestException('Session không hợp lệ!');

    // Lấy giá mặc định từ Product nếu chưa truyền
    if (typeof price === 'undefined') {
      const product = await this.databaseService.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new BadRequestException('Sản phẩm không tồn tại!');
      price = Number(product.price);
    }

    // Kiểm tra xem đã có service đó trong session chưa
    const existing = await this.databaseService.tableSessionService.findFirst({
      where: { sessionId, productId },
    });

    if (existing) {
      // Nếu đã có, cộng dồn số lượng
      return this.databaseService.tableSessionService.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + quantity,
          subtotal: (existing.quantity + quantity) * Number(existing.price),
        },
      });
    }

    // Nếu chưa thì tạo mới
    const product = await this.databaseService.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
    return this.databaseService.tableSessionService.create({
      data: {
        sessionId,
        productId,
        quantity,
        price: Number(product.price),
        subtotal: quantity * Number(product.price),
      },
    });
  }

  // Xóa dịch vụ khỏi phiên chơi
  async removeService(sessionId: string, serviceId: string) {
    // Có thể kiểm tra session status nếu muốn
    const service = await this.databaseService.tableSessionService.findUnique({
      where: { id: serviceId },
    });
    if (!service || service.sessionId !== sessionId)
      throw new BadRequestException('Dịch vụ không hợp lệ!');

    await this.databaseService.tableSessionService.delete({
      where: { id: serviceId },
    });
    return { success: true };
  }

  // Cập nhật số lượng dịch vụ trong phiên chơi
  async updateServiceQuantity(
    sessionId: string,
    serviceId: string,
    quantity: number,
  ) {
    if (quantity <= 0) {
      // Xóa nếu số lượng về 0
      return this.databaseService.tableSessionService.delete({
        where: { id: serviceId },
      });
    }
    const service = await this.databaseService.tableSessionService.findUnique({
      where: { id: serviceId },
    });
    if (!service || service.sessionId !== sessionId)
      throw new BadRequestException('Dịch vụ không hợp lệ!');
    return this.databaseService.tableSessionService.update({
      where: { id: serviceId },
      data: {
        quantity,
        subtotal: quantity * Number(service.price),
      },
    });
  }
}
