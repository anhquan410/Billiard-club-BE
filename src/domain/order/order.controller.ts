import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    // Get all orders
    @Get('/all')
    @UseGuards(RolesGuard)
    @Roles('ADMIN') // Chỉ ADMIN mới có thể xem danh sách hóa đơn
    async getAllOrders() {
        return this.orderService.getAllOrders();
    }
}
