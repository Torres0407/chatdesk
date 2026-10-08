import { maskPhoneNumber, maskPhoneNumbersInObject } from './phone-mask.util';

describe('PhoneMaskUtil', () => {
  it('should mask phone numbers in Nigerian international format', () => {
    expect(maskPhoneNumber('+2348012344567')).toBe('+234 *** *** 4567');
  });

  it('should mask phone numbers with arbitrary country codes', () => {
    expect(maskPhoneNumber('+15551234567')).toBe('+1 *** *** 4567');
    expect(maskPhoneNumber('+447911123456')).toBe('+44 *** *** 3456');
  });

  it('should handle short or empty inputs', () => {
    expect(maskPhoneNumber('')).toBe('');
    expect(maskPhoneNumber('123')).toBe('****');
  });

  it('should recursively mask phone fields in objects and nested arrays', () => {
    const input = {
      customer: {
        id: 'cust-1',
        phoneNumber: '+2348012344567',
        phone: '+2347099991111',
      },
      recipients: [{ phone: '+2348100002222' }],
      unrelated: 'hello world',
    };

    const masked = maskPhoneNumbersInObject(input);
    expect(masked.customer.phoneNumber).toBe('+234 *** *** 4567');
    expect(masked.customer.phone).toBe('+234 *** *** 1111');
    expect(masked.recipients[0].phone).toBe('+234 *** *** 2222');
    expect(masked.unrelated).toBe('hello world');
  });
});
