import { ApiProperty } from '@nestjs/swagger';

export class DeleteSafeDelegateRequest {
  @ApiProperty()
  delegate: string;
  @ApiProperty()
  safe: string;
  @ApiProperty()
  signature: string;
}
