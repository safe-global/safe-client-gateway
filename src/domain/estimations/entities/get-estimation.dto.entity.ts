import { Operation } from '../../safe/entities/operation.entity';

export class GetEstimationDto {
  to: string;
  value: string;
  data: string | null;
  operation: Operation;

  constructor(to: string, value: string, data: string, operation: Operation) {
    this.to = to;
    this.value = value;
    this.data = data;
    this.operation = operation;
  }
}
