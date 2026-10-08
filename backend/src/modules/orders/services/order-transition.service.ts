import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  VALID_ORDER_TRANSITIONS,
  InvalidOrderTransitionException,
} from '../constants/order-status.constants';

@Injectable()
export class OrderTransitionService {
  private readonly logger = new Logger(OrderTransitionService.name);

  canTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
    if (currentStatus === targetStatus) {
      return true;
    }
    const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  validateTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): void {
    if (!this.canTransition(currentStatus, targetStatus)) {
      this.logger.warn(
        `Invalid order status transition requested: ${currentStatus} -> ${targetStatus}`,
      );
      throw new InvalidOrderTransitionException(currentStatus, targetStatus);
    }
  }
}
