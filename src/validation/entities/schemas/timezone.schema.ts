import { z } from 'zod';

/**
 * Validates a timezone schema
 *    i.e. whether or not our Node version supports timezone and the timezone is valid
 *
 * @param {string | undefined} timezone The timezone string to check for validity
 *
 * @returns {boolean} Returns 'true' if the timezone is valid, otherwise 'false'
 */
export const TimezoneSchema = z.string().refine(
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
    Intl.DateTimeFormat(undefined, { timeZone: timezone });

    return true;
  } catch {
    return false;
  }
};
