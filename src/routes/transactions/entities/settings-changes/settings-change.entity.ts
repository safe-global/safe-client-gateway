import { ApiProperty } from '@nestjs/swagger';

export abstract class SettingsChange {
  @ApiProperty()
  type: string;

  protected constructor(type: string) {
    this.type = type;
  }
}
