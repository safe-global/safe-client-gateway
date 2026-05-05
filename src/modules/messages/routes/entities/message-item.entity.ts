// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { Message } from '@/modules/messages/routes/entities/message.entity';

export class MessageItem extends Message {
  @ApiProperty({ enum: ['MESSAGE'] })
  type: 'MESSAGE';

  constructor(...args: ConstructorParameters<typeof Message>) {
    super(...args);
    this.type = 'MESSAGE';
  }
}
