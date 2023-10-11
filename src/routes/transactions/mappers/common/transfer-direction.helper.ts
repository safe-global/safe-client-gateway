import { TransferDirection } from '@/routes/transactions/entities/transfer-transaction-info.entity';

export function getTransferDirection(
  safeAddress: string,
  from: string,
  to: string,
): TransferDirection {
  if (safeAddress === from) {
    return TransferDirection.Outgoing;
  }
  if (safeAddress === to) {
    return TransferDirection.Incoming;
  }
  return TransferDirection.Unknown;
}
