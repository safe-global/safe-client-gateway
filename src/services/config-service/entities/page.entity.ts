export interface Page<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}
