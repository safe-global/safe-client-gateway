import { Message } from '@/routes/messages/entities/message.entity';
import { ApiProperty } from '@nestjs/swagger';

export class MessageItem extends Message {
  @ApiProperty()
  type: string;

  constructor(...args: ConstructorParameters<typeof Message>) {
    super(...args);
    this.type = 'MESSAGE';
  }
}
