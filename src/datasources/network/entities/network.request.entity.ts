type Primitive = string | number | bigint | boolean | undefined | symbol | null;

export interface NetworkRequest {
  headers?: Record<string, string>;
  params?: Record<string, Primitive>;
}
