import {
  calculateTimezoneOffset,
  convertToTimezone,
} from '@/routes/transactions/helpers/timezone.helper';

describe('Intl', () => {
  it('Should ensure Intl timezone is enabled on server', () => {
    expect(Intl).toBeDefined();
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBeDefined();
  });
});

describe('convertToTimezone()', () => {
  it('Should correctly convert a date to the specified timezone', () => {
    const inputTimeZone = 'Europe/Berlin';
    const inputDate = new Date('2024-09-09T23:00:00Z'); // UTC time

    const expectedDate = new Date('2024-09-10T02:00:00+02:00'); // Berlin Summer time (UTC+2) to UTC

    const result = convertToTimezone(inputDate, inputTimeZone);

    expect(result?.toISOString()).toBe(expectedDate.toISOString());
  });

  it('Should correctly handle a different timezone', () => {
    const inputDate = new Date('2024-09-09T12:00:00Z'); // UTC time
    const inputTimeZone = 'America/New_York';
    const expectedDate = new Date('2024-09-08T20:00:00-04:00'); // New York time (UTC-4)

    const result = convertToTimezone(inputDate, inputTimeZone);

    expect(result?.toISOString()).toBe(expectedDate.toISOString());
  });

  it('Should throw if an invalid timezone provided', () => {
    const date = new Date('2024-09-09T12:00:00Z'); // UTC time
    const timeZone = 'Invalid/Timezone';

    const result = (): Date => convertToTimezone(date, timeZone);

    expect(result).toThrow(RangeError);
  });

  it('Should handle a date at midnight UTC correctly', () => {
    const date = new Date('2024-09-09T00:00:00Z'); // Midnight UTC
    const timeZone = 'Asia/Tokyo';
    const expectedDate = new Date('2024-09-09T09:00:00+09:00'); // Tokyo time (UTC+9)

    const result = convertToTimezone(date, timeZone);

    expect(result?.toISOString()).toBe(expectedDate.toISOString());
  });

  it('Should return the same date for the same timezone', () => {
    const date = new Date('2024-09-09T00:00:00Z'); // UTC time
    const timeZone = 'UTC';

    const result = convertToTimezone(date, timeZone);

    expect(result?.toISOString()).toBe(date.toISOString());
  });
});

describe('calculateTimezoneOffset', () => {
  it('Should return the correct UTC date at midnight when given a positive timezone offset', () => {
    const timestamp = new Date('2024-09-09T12:00:00Z'); // 12:00 PM UTC
    const timezoneOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

    const result = calculateTimezoneOffset(timestamp, timezoneOffset);
    const expected = new Date(Date.UTC(2024, 8, 9)); // September is month 8 (0-indexed), should be 2024-09-09T00:00:00Z

    expect(result).toEqual(expected);
  });

  it('Should return the correct UTC date at midnight when given a negative timezone offset', () => {
    const timestamp = new Date('2024-09-09T12:00:00Z'); // 12:00 PM UTC
    const timezoneOffset = -3 * 60 * 60 * 1000; // -3 hours in milliseconds

    const result = calculateTimezoneOffset(timestamp, timezoneOffset);
    const expected = new Date(Date.UTC(2024, 8, 9)); // September is month 8 (0-indexed), should be 2024-09-09T00:00:00Z

    expect(result).toEqual(expected);
  });

  it('Should handle timezone offset resulting in previous or next day correctly', () => {
    const inputTimestamp = new Date('2024-09-09T23:00:00Z');
    const inputTimezoneOffset = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    const result = calculateTimezoneOffset(inputTimestamp, inputTimezoneOffset);
    const expected = new Date(Date.UTC(2024, 8, 10));

    expect(result).toEqual(expected);
  });

  it('Should return the correct UTC date at midnight with zero offset', () => {
    const timestamp = new Date('2024-09-09T12:00:00Z'); // 12:00 PM UTC
    const timezoneOffset = 0; // No offset

    const result = calculateTimezoneOffset(timestamp, timezoneOffset);
    const expected = new Date(Date.UTC(2024, 8, 9)); // September is month 8 (0-indexed), should be 2024-09-09T00:00:00Z

    expect(result).toEqual(expected);
  });
});
