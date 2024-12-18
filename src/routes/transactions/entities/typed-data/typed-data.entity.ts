import { ApiPropertyOptional } from '@nestjs/swagger';

export class TypedData {
  @ApiPropertyOptional({ nullable: true })
  domainHash: `0x${string}` | null;

  @ApiPropertyOptional({ nullable: true })
  messageHash: `0x${string}` | null;

  constructor(args: {
    domainHash: `0x${string}` | null;
    messageHash: `0x${string}` | null;
  }) {
    this.domainHash = args.domainHash;
    this.messageHash = args.messageHash;
  }
}
