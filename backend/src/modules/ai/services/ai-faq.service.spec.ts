import { Test, TestingModule } from '@nestjs/testing';
import { AiFaqService } from './ai-faq.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AiFaqService', () => {
  let service: AiFaqService;
  let mockConfigService: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'AI_FAQ_ENABLED') return true;
        if (key === 'OPENAI_API_KEY') return 'mock_key';
        if (key === 'OPENAI_MODEL') return 'gpt-4o-mini';
        return defaultValue;
      }),
    };

    mockPrismaService = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Acme Coffee Shop',
          currency: 'NGN',
        }),
      },
      faq: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'faq-1',
            question: 'What are your delivery hours?',
            answer: 'We deliver daily between 9 AM and 6 PM.',
            keywords: ['delivery', 'hours', 'shipping'],
            isActive: true,
          },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiFaqService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AiFaqService>(AiFaqService);
  });

  it('should return null if feature flag AI_FAQ_ENABLED is disabled', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AI_FAQ_ENABLED') return false;
      return null;
    });

    const disabledService = new AiFaqService(mockConfigService, mockPrismaService);
    const result = await disabledService.answerFaq('biz-1', 'What are your delivery hours?');

    expect(result.answer).toBeNull();
    expect(result.confidence).toBe('NONE');
  });

  it('should return context-matched answer for matching question when using mock/test key', async () => {
    const result = await service.answerFaq('biz-1', 'When do you offer delivery?');

    expect(result.confidence).toBe('HIGH');
    expect(result.answer).toContain('We deliver daily between 9 AM and 6 PM');
  });

  it('should return null/low confidence when query cannot be answered from business FAQs', async () => {
    const result = await service.answerFaq('biz-1', 'Do you repair spaceships?');

    expect(result.answer).toBeNull();
    expect(result.confidence).toBe('LOW');
  });
});
