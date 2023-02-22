export enum SignatureType {
  ContractSignature = 'CONTRACT_SIGNATURE',
  ApprovedHash = 'APPROVED_HASH',
  Eoa = 'EOA',
  EthSign = 'ETH_SIGN',
}

export interface MessageConfirmation {
  created: Date;
  modified: Date;
  owner: string;
  signature: string;
  signatureType: SignatureType;
}
