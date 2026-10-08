import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { ConversationStatus } from '@prisma/client';

export class ConversationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor ID for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Maximum number of items to return', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({ description: 'Search term for customer name or phone number' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class StaffReplyDto {
  @ApiProperty({ example: 'Hello! I am taking over this chat to assist you.', description: 'Message body text' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
