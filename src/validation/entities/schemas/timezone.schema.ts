import { z } from 'zod';

/**
 * Validates a timezone schema
 *    e.g. whether or not the requested timezone is a valid timezone string
 *
 * @param {string} timezone The timezone string to check for validity
 *
 * @returns {boolean} Returns 'true' if the timezone is valid, otherwise 'false'
 */
export const TimezoneSchema = z.string().refine(
  (timezone: string): boolean => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });

      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid Timezone' },
);
