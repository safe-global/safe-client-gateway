export class Submission {
  id: number;
  targeted_safe_id: number;
  signer_address: `0x${string}`;
  completion_date: string;
  created_at: string;
  updated_at: string;

  constructor(
    id: number,
    targeted_safe_id: number,
    signer_address: `0x${string}`,
    completion_date: string,
    created_at: string,
    updated_at: string,
  ) {
    this.id = id;
    this.targeted_safe_id = targeted_safe_id;
    this.signer_address = signer_address;
    this.completion_date = completion_date;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
