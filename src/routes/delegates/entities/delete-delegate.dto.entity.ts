import { ApiProperty } from '@nestjs/swagger';

export class DeleteDelegateDto {
  @ApiProperty()
  delegate: string;
  @ApiProperty()
  delegator: string;
  @ApiProperty()
  signature: string;

  constructor(delegate: string, delegator: string, signature: string) {
    this.delegate = delegate;
    this.delegator = delegator;
    this.signature = signature;
  }
}
