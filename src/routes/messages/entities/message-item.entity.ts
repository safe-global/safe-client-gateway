import { ApiProperty } from '@nestjs/swagger';
import { Message } from './message.entity';

export class MessageItem extends Message {
  @ApiProperty()
  type: string;

  constructor(...args: ConstructorParameters<typeof Message>) {
    super(...args);
    this.type = 'MESSAGE';
  }
}
