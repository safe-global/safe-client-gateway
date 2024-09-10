import { z } from 'zod';

/**
 * Validates a timezone
 *
 * @param {string | undefined} timezone The timezone string to check for validity
 *
 * @returns {boolean} Returns 'true' if the timezone is valid, otherwise 'false'
 */
export const TimezoneSchema = z
  .string()
  .optional()
  .refine(
    (timezone: string | undefined): boolean => {
      if (timezone) {
        if (!isTimezoneEnabled() || !isTimezoneValid(timezone)) {
          return false;
        }
      }

      return true;
    },
    { message: 'Invalid Timezone' },
  );

const isTimezoneEnabled = (): boolean => {
  return !Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone
    ? false
    : true;
};

const isTimezoneValid = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone ?? 'INVALID' });

    return true;
  } catch {
    return false;
  }
};
