import { ApiProperty } from '@nestjs/swagger';

export enum ExecutionDetailsType {
  Module = 'MODULE',
  Multisig = 'MULTISIG',
}

export abstract class ExecutionDetails {
  @ApiProperty({ enum: ExecutionDetailsType })
  type: ExecutionDetailsType;

  protected constructor(type: ExecutionDetailsType) {
    this.type = type;
  }
}
