export interface Email {
  id: number;
  chain_id: number;
  email_address: string;
  safe_address: string;
  signer: string;
  verified: boolean;
  verification_code?: string;
  sent_on: Date;
}
