// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { MessageItem } from '@/modules/messages/routes/entities/message-item.entity';
import { DateLabel } from '@/routes/common/entities/date-label.entity';
import { Page } from '@/routes/common/entities/page.entity';

@ApiExtraModels(MessageItem, DateLabel)
export class MessagePage extends Page<MessageItem | DateLabel> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(MessageItem) },
      { $ref: getSchemaPath(DateLabel) },
    ],
  })
  results!: Array<MessageItem | DateLabel>;
}
