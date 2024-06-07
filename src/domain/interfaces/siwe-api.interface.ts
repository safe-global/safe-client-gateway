export const ISiweApi = Symbol('ISiweApi');

export interface ISiweApi {
  storeNonce(nonce: string): Promise<void>;

  getNonce(nonce: string): Promise<string | undefined>;

  clearNonce(nonce: string): Promise<void>;
}
