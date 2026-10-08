import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventBusService } from './services/event-bus.service';
import { of } from 'rxjs';

describe('EventsController', () => {
  let controller: EventsController;
  let mockEventBus: Partial<EventBusService>;

  beforeEach(async () => {
    mockEventBus = {
      getEventStream: jest.fn().mockReturnValue(of({ data: { type: 'connected' } })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventBusService, useValue: mockEventBus }],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should call getEventStream with authenticated businessId', (done) => {
    const businessId = 'biz-auth-test-99';
    const stream$ = controller.streamEvents(businessId);

    stream$.subscribe((event) => {
      expect(mockEventBus.getEventStream).toHaveBeenCalledWith(businessId);
      expect(event).toEqual({ data: { type: 'connected' } });
      done();
    });
  });
});
