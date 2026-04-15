import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class OrderService {
    constructor(private readonly databaseService: DatabaseService) {}

    // Get all orders
    async getAllOrders() {
        return this.databaseService.order.findMany();
    }
}
