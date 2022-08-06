export interface BaseError {
  message: string;
  statusCode: number;
  arguments: string[];
}
