import { ApiProperty } from '@nestjs/swagger';

export abstract class ExecutionDetails {
  @ApiProperty()
  type: string;

  protected constructor(type: string) {
    this.type = type;
  }
}
