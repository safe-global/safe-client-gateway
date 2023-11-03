import { CreateEmailMessageDto } from '@/domain/email/entities/create-email-message.dto.entity';

export const IEmailApi = Symbol('IEmailApi');

export interface IEmailApi {
  createMessage(createEmailMessageDto: CreateEmailMessageDto): Promise<void>;
}
