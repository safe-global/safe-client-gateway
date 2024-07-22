export type NotificationSubscription = {
  id: number;
  account_id: number;
  chain_id: string;
  safe_address: `0x${string}`;
  created_at: Date;
  updated_at: Date;
};
