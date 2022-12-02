export interface Safe {
  address: string;
  fallbackHandler: string;
  guard: string;
  masterCopy: string;
  modules?: string[];
  nonce: number;
  owners: string[];
  threshold: number;
  version: string;
}
