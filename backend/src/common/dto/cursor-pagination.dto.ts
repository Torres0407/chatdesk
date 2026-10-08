import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Cursor ID for pagination (fetches items after this ID)', example: 'clx123456789' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Maximum number of items to return', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'List of paginated items' })
  items!: T[];

  @ApiPropertyOptional({ description: 'Cursor to provide in next request to retrieve next page, or null if end of list', example: 'clx123456789', nullable: true })
  nextCursor!: string | null;
}
