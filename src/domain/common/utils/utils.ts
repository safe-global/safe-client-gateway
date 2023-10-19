export function getNumberString(value: number): string {
  // Prevent scientific notation
  return value.toLocaleString('fullwide', {
    useGrouping: false,
  });
}
