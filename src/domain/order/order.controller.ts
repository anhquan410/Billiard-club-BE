/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Get all orders (Admin only)
  @Get('/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAllOrders() {
    return this.orderService.getAllOrders();
  }

  // Get order by ID
  @Get('/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  async getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  // Calculate order with bonus (preview before creating)
  @Post('/calculate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  async calculateOrder(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.calculateOrder(createOrderDto);
  }

  // Create new order
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  async createOrder(@Body() createOrderDto: CreateOrderDto, @User() user: any) {
    // Đảm bảo createdBy là user hiện tại
    createOrderDto.createdBy = user.id;
    return this.orderService.createOrder(createOrderDto);
  }

  // Complete payment (mark as paid and earn bonus points)
  @Patch('/:id/complete-payment')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  async completePayment(@Param('id') id: string) {
    return this.orderService.completePayment(id);
  }
}
