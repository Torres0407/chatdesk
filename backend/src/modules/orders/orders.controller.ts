import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrderService } from './services/order.service';
import { OrderStatus } from './constants/order-status.constants';
import { CursorPaginationQueryDto, PaginatedResponseDto } from '../../common/dto/cursor-pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

export class OrderQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status!: OrderStatus;
}

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tenant orders with status filter and cursor pagination' })
  async listOrders(
    @CurrentUser('businessId') businessId: string,
    @Query() query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const limit = query.limit || 20;
    const where: any = {
      businessId,
      ...(query.status ? { status: query.status } : {}),
    };

    const items = await this.prisma.order.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: true,
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return { items, nextCursor };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async getOrder(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id, businessId },
      include: { customer: true, items: true, conversation: true },
    });

    if (!order) {
      throw new Error(`Order ${id} not found.`);
    }

    return order;
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status and notify customer on WhatsApp' })
  async updateStatus(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(businessId, id, body.status, true);
  }
}
