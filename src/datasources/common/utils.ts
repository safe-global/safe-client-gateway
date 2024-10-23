/**
 * Converts the input to a Date object.
 *
 * Note: This function is used to parse dates from the cache, which are stored as JSON strings.
 *
 * @param date - The date input which can be either a Date object or a string.
 * @returns A Date object representing the converted date.
 */
export function convertToDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}
