export interface Collectible {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  logoUri: string;
  id: string;
  uri?: string;
  name?: string;
  description?: string;
  imageUri?: string;
  metadata?: Record<string, any>;
}
