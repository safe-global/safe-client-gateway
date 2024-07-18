export function getMillisecondsUntil(date: Date): number {
  return date.getTime() - Date.now();
}

export function getSecondsUntil(date: Date): number {
  return Math.floor(getMillisecondsUntil(date) / 1_000);
}

export const toSecondsTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1_000);
};
