import { ApiProperty } from '@nestjs/swagger';

export class SafeRegistration {
  @ApiProperty()
  chain_id: string;
  @ApiProperty()
  safes: string[];
  @ApiProperty()
  signatures: string[];
}
