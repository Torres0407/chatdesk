import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CursorPaginationQueryDto, PaginatedResponseDto } from '../../common/dto/cursor-pagination.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Ergonomic Mouse' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'High precision wireless mouse' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 12000 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'SKU-MOU-01' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/mouse.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Wireless Ergonomic Mouse v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Upgraded sensor wireless mouse' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 14000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/mouse.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant products with cursor pagination' })
  async listProducts(
    @CurrentUser('businessId') businessId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<PaginatedResponseDto<any>> {
    const limit = query.limit || 20;

    const items = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return { items, nextCursor };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async getProduct(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found.`);
    }

    return product;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  async createProduct(
    @CurrentUser('businessId') businessId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.prisma.product.create({
      data: {
        businessId,
        name: dto.name,
        description: dto.description || null,
        price: dto.price,
        currency: dto.currency || 'NGN',
        sku: dto.sku || null,
        imageUrl: dto.imageUrl || null,
        category: dto.category || null,
        isActive: true,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product details' })
  async updateProduct(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    await this.getProduct(businessId, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable product instead of hard deletion' })
  async deleteProduct(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    await this.getProduct(businessId, id);

    // Rule: Disable instead of delete
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
