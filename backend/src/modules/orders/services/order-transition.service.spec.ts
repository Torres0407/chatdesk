import { OrderTransitionService } from './order-transition.service';
import {
  OrderStatus,
  InvalidOrderTransitionException,
} from '../constants/order-status.constants';

describe('OrderTransitionService', () => {
  let service: OrderTransitionService;

  beforeEach(() => {
    service = new OrderTransitionService();
  });

  describe('valid transitions', () => {
    it('should allow PENDING -> PAID', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
      expect(() =>
        service.validateTransition(OrderStatus.PENDING, OrderStatus.PAID),
      ).not.toThrow();
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(() =>
        service.validateTransition(OrderStatus.PENDING, OrderStatus.CANCELLED),
      ).not.toThrow();
    });

    it('should allow PAID -> PREPARING', () => {
      expect(service.canTransition(OrderStatus.PAID, OrderStatus.PREPARING)).toBe(true);
      expect(() =>
        service.validateTransition(OrderStatus.PAID, OrderStatus.PREPARING),
      ).not.toThrow();
    });

    it('should allow PAID -> CANCELLED', () => {
      expect(service.canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
      expect(() =>
        service.validateTransition(OrderStatus.PAID, OrderStatus.CANCELLED),
      ).not.toThrow();
    });

    it('should allow PREPARING -> COMPLETED', () => {
      expect(service.canTransition(OrderStatus.PREPARING, OrderStatus.COMPLETED)).toBe(true);
      expect(() =>
        service.validateTransition(OrderStatus.PREPARING, OrderStatus.COMPLETED),
      ).not.toThrow();
    });

    it('should allow same status transition idempotently', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should reject PENDING -> COMPLETED directly', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.COMPLETED)).toBe(false);
      expect(() =>
        service.validateTransition(OrderStatus.PENDING, OrderStatus.COMPLETED),
      ).toThrow(InvalidOrderTransitionException);
    });

    it('should reject COMPLETED -> PAID (terminal state)', () => {
      expect(service.canTransition(OrderStatus.COMPLETED, OrderStatus.PAID)).toBe(false);
      expect(() =>
        service.validateTransition(OrderStatus.COMPLETED, OrderStatus.PAID),
      ).toThrow(InvalidOrderTransitionException);
    });

    it('should reject CANCELLED -> PREPARING (terminal state)', () => {
      expect(service.canTransition(OrderStatus.CANCELLED, OrderStatus.PREPARING)).toBe(false);
      expect(() =>
        service.validateTransition(OrderStatus.CANCELLED, OrderStatus.PREPARING),
      ).toThrow(InvalidOrderTransitionException);
    });
  });
});
