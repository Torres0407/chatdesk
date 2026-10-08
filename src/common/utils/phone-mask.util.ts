/**
 * Utility to mask phone numbers for API responses and logs.
 * Example: +2348012344567 -> +234 *** *** 4567 or +234 801 234 4567 -> +234 *** *** 4567
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '****';

  const last4 = cleaned.slice(-4);

  // Check standard known country code prefixes (+234, +44, +1, etc.) or generic +XX
  let countryCode = '';
  if (cleaned.startsWith('+234')) {
    countryCode = '+234';
  } else if (cleaned.startsWith('+44')) {
    countryCode = '+44';
  } else if (cleaned.startsWith('+1')) {
    countryCode = '+1';
  } else {
    const match = cleaned.match(/^(\+[0-9]{1,3})/);
    if (match) {
      countryCode = match[1];
    }
  }

  if (countryCode && cleaned.length > countryCode.length + 4) {
    return `${countryCode} *** *** ${last4}`;
  }

  return `*** *** ${last4}`;
}

/**
 * Deep masks phone number fields in objects and arrays.
 */
export function maskPhoneNumbersInObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => maskPhoneNumbersInObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (
        (key === 'phoneNumber' || key === 'phone' || key === 'from' || key === 'recipient') &&
        typeof value === 'string'
      ) {
        result[key] = maskPhoneNumber(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = maskPhoneNumbersInObject(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return obj;
}
