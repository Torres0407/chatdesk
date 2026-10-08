import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { StaffRole } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'owner@shop.com', description: 'Staff user email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123!', description: 'Password' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password!: string;
}

export class StaffUserResponseDto {
  @ApiProperty({ example: 'clx_user_123' })
  id!: string;

  @ApiProperty({ example: 'clx_biz_123' })
  businessId!: string;

  @ApiProperty({ example: 'owner@shop.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ enum: StaffRole, example: StaffRole.OWNER })
  role!: StaffRole;

  @ApiPropertyOptional({ example: 'Acme Superstore' })
  businessName?: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT Access Token (15m validity)' })
  accessToken!: string;

  @ApiProperty({ type: StaffUserResponseDto })
  user!: StaffUserResponseDto;
}

export interface JwtPayload {
  sub: string;
  userId?: string;
  email: string;
  businessId: string;
  role: StaffRole;
  name?: string;
  businessName?: string;
}
