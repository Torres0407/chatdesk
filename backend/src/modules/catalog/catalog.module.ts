import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CatalogController],
  exports: [],
})
export class CatalogModule {}
