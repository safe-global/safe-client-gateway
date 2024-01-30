export interface Collectible {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  logoUri: string;
  id: string;
  uri: string | null;
  name: string | null;
  description: string | null;
  imageUri: string | null;
  metadata: Record<string, unknown> | null;
}
