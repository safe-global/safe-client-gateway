export interface SafeConfigPage<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}
