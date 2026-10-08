import { OrderStatus } from '@prisma/client';

export { OrderStatus };

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export class InvalidOrderTransitionException extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot transition order from status '${from}' to '${to}'.`);
    this.name = 'InvalidOrderTransitionException';
  }
}
