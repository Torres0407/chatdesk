import { FaqHandler } from './faq.handler';

describe('FaqHandler', () => {
  let handler: FaqHandler;
  let mockPrisma: any;
  let mockStateService: any;
  let mockOutboundService: any;

  beforeEach(() => {
    mockPrisma = {
      faq: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    mockStateService = {
      setState: jest.fn(),
    };
    mockOutboundService = {
      sendButtons: jest.fn(),
      sendList: jest.fn(),
    };
    handler = new FaqHandler(mockPrisma, mockStateService, mockOutboundService);
  });

  it('should show fallback when no FAQs exist', async () => {
    mockPrisma.faq.findMany.mockResolvedValue([]);

    await handler.showFaqList('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('No FAQs are currently listed'),
      expect.any(Array),
    );
  });

  it('should show buttons when 3 or fewer FAQs exist', async () => {
    mockPrisma.faq.findMany.mockResolvedValue([
      { id: '1', question: 'What are your hours?', answer: '9am - 5pm' },
      { id: '2', question: 'Where are you located?', answer: 'Lagos, Nigeria' },
    ]);

    await handler.showFaqList('biz-1', 'conv-1', 'cust-1', '+2348012345678');

    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ id: 'faq_1' }),
        expect.objectContaining({ id: 'faq_2' }),
      ]),
      expect.any(Object),
    );
  });

  it('should find and answer FAQ when keywords match', async () => {
    mockPrisma.faq.findMany.mockResolvedValue([
      {
        id: 'faq-123',
        question: 'What is your delivery fee?',
        answer: 'Delivery is 1,500 NGN flat rate in Lagos.',
        keywords: ['delivery', 'shipping', 'cost', 'fee'],
      },
    ]);
    mockPrisma.faq.findFirst.mockResolvedValue({
      id: 'faq-123',
      question: 'What is your delivery fee?',
      answer: 'Delivery is 1,500 NGN flat rate in Lagos.',
    });

    const matched = await handler.searchAndAnswerFaq(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      'how much is shipping cost?',
    );

    expect(matched).toBe(true);
    expect(mockOutboundService.sendButtons).toHaveBeenCalledWith(
      'biz-1',
      'conv-1',
      'cust-1',
      '+2348012345678',
      expect.stringContaining('1,500 NGN'),
      expect.any(Array),
      expect.any(Object),
    );
  });
});
