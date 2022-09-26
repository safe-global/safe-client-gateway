export type NetworkError =
  | NetworkResponseError
  | NetworkRequestError
  | NetworkOtherError;

export class NetworkResponseError extends Error {
  constructor(readonly data: any, readonly status) {
    super();
  }
}

export class NetworkRequestError extends Error {
  constructor(readonly request: any) {
    super();
  }
}

export class NetworkOtherError extends Error {
  constructor(readonly message: string) {
    super(message);
  }
}
