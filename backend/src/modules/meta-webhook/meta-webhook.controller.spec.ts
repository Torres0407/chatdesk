import { Test, TestingModule } from '@nestjs/testing';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './services/meta-webhook.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import textMessageFixture from '../../../test/fixtures/meta-payloads/text-message.fixture.json';

describe('MetaWebhookController', () => {
  let controller: MetaWebhookController;
  let webhookService: jest.Mocked<Partial<MetaWebhookService>>;

  beforeEach(async () => {
    webhookService = {
      verifyWebhook: jest.fn(),
      enqueuePayload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaWebhookController],
      providers: [
        {
          provide: MetaWebhookService,
          useValue: webhookService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test_secret'),
          },
        },
      ],
    }).compile();

    controller = module.get<MetaWebhookController>(MetaWebhookController);
  });

  describe('GET verifyWebhook', () => {
    it('should return challenge on valid token', () => {
      (webhookService.verifyWebhook as jest.Mock).mockReturnValue('1158201444');

      const result = controller.verifyWebhook({
        'hub.mode': 'subscribe',
        'hub.challenge': '1158201444',
        'hub.verify_token': 'correct_token',
      });

      expect(result).toBe('1158201444');
      expect(webhookService.verifyWebhook).toHaveBeenCalled();
    });

    it('should throw ForbiddenException on invalid token', () => {
      (webhookService.verifyWebhook as jest.Mock).mockImplementation(() => {
        throw new ForbiddenException('Invalid verification token');
      });

      expect(() => {
        controller.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.challenge': '1158201444',
          'hub.verify_token': 'wrong_token',
        });
      }).toThrow(ForbiddenException);
    });
  });

  describe('POST handleWebhook', () => {
    it('should enqueue payload and return fast 200 response', async () => {
      (webhookService.enqueuePayload as jest.Mock).mockResolvedValue({
        status: 'queued',
        received: true,
      });

      const response = await controller.handleWebhook(textMessageFixture as any, {} as any);

      expect(response).toEqual({ status: 'queued', received: true });
      expect(webhookService.enqueuePayload).toHaveBeenCalledWith(textMessageFixture);
    });
  });
});
