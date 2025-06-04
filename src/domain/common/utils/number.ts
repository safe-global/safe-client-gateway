/**
 * Randomly deviates a number by up to a given percentage
 *
 * @param {number} number - The base number to deviate
 * @param {number} percent - The maximum percentage to deviate by (e.g. 10 for ±10%)
 *
 * @returns {number} The number randomly deviated by up to ±percent%
 */
export function deviateRandomlyByPercentage(
  number: number,
  percent: number,
): number {
  const maxDeviation = Math.abs(number) * (percent / 100);
  const delta = Math.ceil(Math.random() * maxDeviation * 2 - maxDeviation);

  return number + delta;
}

/**
 * Calculates a number increased by a percentage offset
 *
 * @param {number} number - The base number to offset
 * @param {number} percent - The percentage to offset by (e.g. 10 for 10%)
 *
 * @returns {number} The number increased by the percentage amount
 */
export function offsetByPercentage(number: number, percent: number): number {
  const deviation = Math.abs(number) * (percent / 100);
  return Math.ceil(number + deviation);
}
