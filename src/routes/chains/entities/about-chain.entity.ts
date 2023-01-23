import { ApiProperty } from '@nestjs/swagger';

export class AboutChain {
  @ApiProperty()
  transactionServiceBaseUri: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  version: string;
  @ApiProperty()
  buildNumber: string;

  constructor(
    transactionServiceBaseUri: string,
    name: string,
    version: string,
    buildNumber: string,
  ) {
    this.transactionServiceBaseUri = transactionServiceBaseUri;
    this.name = name;
    this.version = version;
    this.buildNumber = buildNumber;
  }
}
