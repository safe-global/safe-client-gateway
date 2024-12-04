export class AddressBook {
  id: number;
  account_id: number;
  chain_id: string;
  data: Buffer;
  key: Buffer;
  iv: Buffer;
  created_at: Date;
  updated_at: Date;

  constructor(
    id: number,
    account_id: number,
    chain_id: string,
    data: Buffer,
    key: Buffer,
    iv: Buffer,
    created_at: Date,
    updated_at: Date,
  ) {
    this.id = id;
    this.account_id = account_id;
    this.chain_id = chain_id;
    this.data = data;
    this.key = key;
    this.iv = iv;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
