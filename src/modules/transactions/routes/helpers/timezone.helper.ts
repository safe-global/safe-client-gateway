/**
 * Converts a given date to a specified timezone.
 *
 * @param {Date} date The date object to be converted.
 * @param {string} timeZone The target timezone (e.g., "Europe/Berlin").
 *
 * @returns {Date} A new Date object representing the date converted to the specified timezone
 * @throws {RangeError} Throws if an invalid timezone is sent
 */
export const convertToTimezone = (date: Date, timeZone: string): Date => {
  const convertedDateParts = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = ~~convertedDateParts.find((part) => part.type === 'year')!.value;
  const month = ~~convertedDateParts.find((part) => part.type === 'month')!
    .value;
  const day = ~~convertedDateParts.find((part) => part.type === 'day')!.value;

  const zeroBasedMonth = month - 1; // JavaScript months are zero-indexed (0 for January, 11 for December), so we subtract 1

  return new Date(Date.UTC(year, zeroBasedMonth, day));
};

/**
 * Calculates the local time in UTC based on a provided timestamp and timezone offset.
 *
 * This function adjusts the provided timestamp by a given timezone offset (in milliseconds) and returns a new `Date` object
 * that represents the equivalent UTC date at midnight (00:00:00) for that adjusted timestamp.
 *
 * @param {Date} timestamp - The initial date and time to adjust. This will be cloned and modified.
 * @param {number} timezoneOffset - The offset to apply to the timestamp, in milliseconds. Positive values will move the time forward, and negative values will move it backward.
 *
 * @returns {Date} - A new `Date` object representing the calculated UTC date at midnight (00:00:00) for the adjusted timestamp.
 */
export const calculateTimezoneOffset = (
  timestamp: Date,
  timezoneOffset: number,
): Date => {
  const date = new Date(timestamp.getTime() + timezoneOffset);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};
