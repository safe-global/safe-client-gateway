export type NetworkError =
  | NetworkResponseError
  | NetworkRequestError
  | NetworkOtherError;

/**
 * Represent a network error where a response was received.
 * This usually means that {@link status} is within an error range.
 *
 * {@link data} represents the payload which was received in the response
 */
export class NetworkResponseError extends Error {
  constructor(
    readonly status,
    readonly data?: any,
  ) {
    super();
  }
}

/**
 * Represents a network error where the request was made but a response
 * was never received.
 */
export class NetworkRequestError extends Error {
  constructor(readonly request: any) {
    super();
  }
}

/**
 * Represents a network error on the client level i.e.: an error occurred
 * while setting up the network request
 */
export class NetworkOtherError extends Error {
  constructor(readonly message: string) {
    super(message);
  }
}
