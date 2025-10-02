import { NotificationType as NotificationTypeEnum } from '@/domain/notifications/v2/entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const NotificationTypeResponseSchema = z.object({
  name: z.nativeEnum(NotificationTypeEnum),
});

export class NotificationTypeResponseDto
  implements z.infer<typeof NotificationTypeResponseSchema>
{
  @ApiProperty({
    type: NotificationTypeEnum,
    enum: NotificationTypeEnum,
    enumName: 'NotificationTypeEnum',
    description: 'The notification type name',
  })
  name!: NotificationTypeEnum;
}
