export interface ZerionCollectionInfo {
  content: {
    icon: { url: string };
    banner: { url: string };
  } | null;
  description: string | null;
  name: string | null;
}

export interface ZerionNFTInfo {
  content: {
    preview: { url: string } | null;
    detail: { url: string } | null;
  } | null;
  contract_address: string;
  flags: { is_spam: boolean } | null;
  interface: string | null;
  name: string | null;
  token_id: string;
}

export interface ZerionCollectibleAttributes {
  amount: string;
  changed_at: string;
  collection_info: ZerionCollectionInfo | null;
  nft_info: ZerionNFTInfo;
  price: number;
  value: number;
}

export interface ZerionCollectible {
  attributes: ZerionCollectibleAttributes;
  id: string;
  type: 'nft_positions';
}

export interface ZerionCollectibles {
  data: ZerionCollectible[];
}
