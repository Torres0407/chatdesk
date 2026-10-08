import { Module } from '@nestjs/common';
import { FaqsController } from './faqs.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FaqsController],
  exports: [],
})
export class FaqsModule {}
