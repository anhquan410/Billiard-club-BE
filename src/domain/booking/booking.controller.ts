import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BookingService } from './booking.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CustomerCreateBookingDto } from './dto/customer-create-booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  getDashboard(@Query() query: BookingQueryDto) {
    return this.bookingService.getDashboard(query);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('CUSTOMER')
  getMyBookings(@User('id') userId: string) {
    return this.bookingService.getMyBookings(userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  createBooking(@Body() body: CreateBookingDto) {
    return this.bookingService.createBooking(body);
  }

  @Post('my')
  @UseGuards(RolesGuard)
  @Roles('CUSTOMER')
  createCustomerBooking(
    @User('id') userId: string,
    @Body() body: CustomerCreateBookingDto,
  ) {
    return this.bookingService.createCustomerBooking(userId, body);
  }

  @Get('table/:tableId/active-confirmed')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  getConfirmedBookingForTable(@Param('tableId') tableId: string) {
    return this.bookingService.getConfirmedBookingForTable(tableId);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  confirmBooking(@Param('id') id: string, @User('id') userId: string) {
    return this.bookingService.confirmBooking(id, userId);
  }

  @Patch(':id/no-show')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER')
  markNoShow(@Param('id') id: string) {
    return this.bookingService.markNoShow(id);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF', 'CASHIER', 'CUSTOMER')
  cancelBooking(
    @Param('id') id: string,
    @User('id') userId: string,
    @User('role') role: string,
  ) {
    return this.bookingService.cancelBooking(id, userId, role);
  }
}
