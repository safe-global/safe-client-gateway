import type { Address } from 'viem';

export class TargetedSafe {
  id: number;
  address: Address;
  outreach_id: number;
  chain_id: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(
    id: number,
    address: Address,
    outreach_id: number,
    chain_id: string | null,
    created_at: Date,
    updated_at: Date,
  ) {
    this.id = id;
    this.address = address;
    this.outreach_id = outreach_id;
    this.chain_id = chain_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
