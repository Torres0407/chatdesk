import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateFaqDto {
  @ApiProperty({ example: 'What are your delivery fees?' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ example: 'Standard shipping is 1,500 NGN.' })
  @IsString()
  @IsNotEmpty()
  answer!: string;

  @ApiPropertyOptional({ example: ['shipping', 'delivery', 'cost'] })
  @IsOptional()
  @IsArray()
  keywords?: string[];
}

export class UpdateFaqDto {
  @ApiPropertyOptional({ example: 'Updated question' })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiPropertyOptional({ example: 'Updated answer' })
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiPropertyOptional({ example: ['updated', 'keywords'] })
  @IsOptional()
  @IsArray()
  keywords?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('FAQs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('faqs')
export class FaqsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant FAQs' })
  async listFaqs(@CurrentUser('businessId') businessId: string) {
    return this.prisma.faq.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get FAQ by ID' })
  async getFaq(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const faq = await this.prisma.faq.findFirst({
      where: { id, businessId },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ ${id} not found.`);
    }

    return faq;
  }

  @Post()
  @ApiOperation({ summary: 'Create FAQ entry' })
  async createFaq(
    @CurrentUser('businessId') businessId: string,
    @Body() dto: CreateFaqDto,
  ) {
    return this.prisma.faq.create({
      data: {
        businessId,
        question: dto.question,
        answer: dto.answer,
        keywords: dto.keywords || [],
        isActive: true,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update FAQ entry' })
  async updateFaq(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFaqDto,
  ) {
    await this.getFaq(businessId, id);

    return this.prisma.faq.update({
      where: { id },
      data: {
        ...(dto.question ? { question: dto.question } : {}),
        ...(dto.answer ? { answer: dto.answer } : {}),
        ...(dto.keywords ? { keywords: dto.keywords } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete FAQ entry' })
  async deleteFaq(
    @CurrentUser('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    await this.getFaq(businessId, id);

    return this.prisma.faq.delete({
      where: { id },
    });
  }
}
