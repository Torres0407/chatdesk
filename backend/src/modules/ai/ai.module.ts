import { Module } from '@nestjs/common';
import { AiFaqService } from './services/ai-faq.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AiFaqService],
  exports: [AiFaqService],
})
export class AiModule {}
