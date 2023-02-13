import { Operation } from '../../safe/entities/operation.entity';

export class EstimationRequest {
  to: string;
  value: number;
  data: string | null;
  operation: Operation;

  constructor(to: string, value: number, data: string, operation: Operation) {
    this.to = to;
    this.value = value;
    this.data = data;
    this.operation = operation;
  }
}
