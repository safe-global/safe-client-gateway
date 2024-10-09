export class TargetedSafe {
  id: number;
  address: `0x${string}`;
  outreach_id: number;
  created_at: string;
  updated_at: string;

  constructor(
    id: number,
    address: `0x${string}`,
    outreach_id: number,
    created_at: string,
    updated_at: string,
  ) {
    this.id = id;
    this.address = address;
    this.outreach_id = outreach_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
