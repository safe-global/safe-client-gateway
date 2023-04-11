import { Operation } from '../../safe/entities/operation.entity';

export class PreviewTransactionDto {
  to: string;
  data: string;
  value: string;
  operation: Operation;
}
