import { ApiProperty } from '@nestjs/swagger';

export abstract class ExecutionInfo {
  @ApiProperty()
  type: string;

  protected constructor(type: string) {
    this.type = type;
  }
}
