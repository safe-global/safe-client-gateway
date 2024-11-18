export class AddressBook {
  id: number;
  data: Buffer;
  key: Buffer;
  iv: Buffer;
  account_id: number;
  created_at: Date;
  updated_at: Date;

  constructor(
    id: number,
    data: Buffer,
    key: Buffer,
    iv: Buffer,
    account_id: number,
    created_at: Date,
    updated_at: Date,
  ) {
    this.id = id;
    this.data = data;
    this.key = key;
    this.iv = iv;
    this.account_id = account_id;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}
