import { Controller, Sse, UseGuards, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventBusService } from './services/event-bus.service';

@ApiTags('Realtime Events (SSE)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventBusService: EventBusService) {}

  @Sse()
  @ApiOperation({
    summary: 'Server-Sent Events (SSE) Stream',
    description:
      'Establishes a persistent SSE stream delivering live dashboard updates (new messages, status changes, orders, bookings, handoff requests) scoped to the authenticated staff member’s business.',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established (Content-Type: text/event-stream)',
  })
  streamEvents(@CurrentUser('businessId') businessId: string): Observable<MessageEvent> {
    return this.eventBusService.getEventStream(businessId);
  }
}
