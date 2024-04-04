// TODO: Infer from forthcoming Zod schema
export type SiweMessage = {
  scheme: 'http' | 'https' | undefined;
  domain: string;
  address: `0x${string}`;
  statement: string | undefined;
  uri: string;
  version: '1';
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string | undefined;
  notBefore: string | undefined;
  requestId: string | undefined;
  resources: Array<string> | undefined;
};
