import { PaymentsController } from './payments.controller';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let mockPaymentService: any;

  beforeEach(() => {
    mockPaymentService = {
      processPaymentWebhook: jest.fn(),
    };
    controller = new PaymentsController(mockPaymentService);
  });

  it('should delegate webhook payload to PaymentService', async () => {
    const payload: any = {
      event: 'charge.success',
      data: { reference: 'ref_123' },
    };

    mockPaymentService.processPaymentWebhook.mockResolvedValue({ success: true });

    const result = await controller.handlePaystackWebhook(payload);

    expect(result).toEqual({ success: true });
    expect(mockPaymentService.processPaymentWebhook).toHaveBeenCalledWith(payload);
  });
});
