import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'Welcome to our shop!' })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  catalogEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  bookingsEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  faqEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  aiFaqEnabled?: boolean;

  @ApiPropertyOptional({ example: 'support@business.com' })
  @IsOptional()
  @IsString()
  handoffNotificationEmail?: string;
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get business settings' })
  async getSettings(@CurrentUser('businessId') businessId: string) {
    let settings = await this.prisma.businessSettings.findUnique({
      where: { businessId },
    });

    if (!settings) {
      settings = await this.prisma.businessSettings.create({
        data: { businessId },
      });
    }

    return settings;
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update business settings' })
  async updateSettings(
    @CurrentUser('businessId') businessId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.prisma.businessSettings.upsert({
      where: { businessId },
      update: {
        ...(dto.welcomeMessage !== undefined ? { welcomeMessage: dto.welcomeMessage } : {}),
        ...(dto.catalogEnabled !== undefined ? { catalogEnabled: dto.catalogEnabled } : {}),
        ...(dto.bookingsEnabled !== undefined ? { bookingsEnabled: dto.bookingsEnabled } : {}),
        ...(dto.faqEnabled !== undefined ? { faqEnabled: dto.faqEnabled } : {}),
        ...(dto.aiFaqEnabled !== undefined ? { aiFaqEnabled: dto.aiFaqEnabled } : {}),
        ...(dto.handoffNotificationEmail !== undefined
          ? { handoffNotificationEmail: dto.handoffNotificationEmail }
          : {}),
      },
      create: {
        businessId,
        ...(dto.welcomeMessage ? { welcomeMessage: dto.welcomeMessage } : {}),
        ...(dto.catalogEnabled !== undefined ? { catalogEnabled: dto.catalogEnabled } : {}),
        ...(dto.bookingsEnabled !== undefined ? { bookingsEnabled: dto.bookingsEnabled } : {}),
        ...(dto.faqEnabled !== undefined ? { faqEnabled: dto.faqEnabled } : {}),
        ...(dto.aiFaqEnabled !== undefined ? { aiFaqEnabled: dto.aiFaqEnabled } : {}),
        ...(dto.handoffNotificationEmail
          ? { handoffNotificationEmail: dto.handoffNotificationEmail }
          : {}),
      },
    });
  }

  @Get('opt-outs')
  @ApiOperation({ summary: 'List customer opt-out records for tenant' })
  async getOptOuts(@CurrentUser('businessId') businessId: string) {
    return this.prisma.optOutRecord.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
