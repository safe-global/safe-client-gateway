export function getNumberString(value: number): string {
  // Prevent scientific notation
  return value.toLocaleString('en-US', {
    notation: 'standard',
    useGrouping: false,
  });
}
