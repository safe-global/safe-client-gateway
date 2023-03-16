import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { DateLabel } from '../../common/entities/date-label.entity';
import { Page } from '../../common/entities/page.entity';
import { MessageItem } from './message-item.entity';

@ApiExtraModels(MessageItem, DateLabel)
export class MessagePage extends Page<MessageItem | DateLabel> {
  @ApiProperty({
    isArray: true,
    oneOf: [
      { $ref: getSchemaPath(MessageItem) },
      { $ref: getSchemaPath(DateLabel) },
    ],
  })
  results: (MessageItem | DateLabel)[];
}
