/**
 * Converts a given date to a specified timezone.
 *
 * @param {Date} date The date object to be converted.
 * @param {string} timeZone The target timezone (e.g., "Europe/Berlin").
 *
 * @returns {Date | undefined} A new Date object representing the date converted to the specified timezone. If an error occurs returns undefined
 */
export const convertToTimezone = (
  date: Date,
  timeZone: string,
): Date | undefined => {
  try {
    const convertedDate = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    return new Date(convertedDate);
  } catch {
    return undefined;
  }
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
  const date = structuredClone(timestamp);
  date.setTime(date.getTime() + timezoneOffset);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};
