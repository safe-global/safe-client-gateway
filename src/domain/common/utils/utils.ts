export function getNumberString(value: number): string {
  // Prevent scientific notation
  return value.toLocaleString('en-US', {
    notation: 'standard',
    useGrouping: false,
  });
}

export function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
