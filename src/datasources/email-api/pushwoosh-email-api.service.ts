import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { CreateEmailMessageDto } from '@/domain/email/entities/create-email-message.dto.entity';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class PushwooshEmailApi implements IEmailApi {
  private readonly apiKey: string;
  private readonly applicationCode: string;
  private readonly baseUri: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.apiKey = this.configurationService.getOrThrow<string>('email.apiKey');
    this.applicationCode = this.configurationService.getOrThrow<string>(
      'email.applicationCode',
    );
    this.baseUri =
      this.configurationService.getOrThrow<string>('email.baseUri');
    this.fromEmail =
      this.configurationService.getOrThrow<string>('email.fromEmail');
    this.fromName =
      this.configurationService.getOrThrow<string>('email.fromName');
  }

  async createMessage(
    createEmailMessageDto: CreateEmailMessageDto,
  ): Promise<void> {
    try {
      const url = `${this.baseUri}/json/1.3/createEmailMessage`;
      await this.networkService.post(url, {
        request: {
          application: this.applicationCode,
          auth: this.apiKey,
          notifications: {
            transactionId: 'TODO',
            send_date: 'now',
            email_template: createEmailMessageDto.template,
            devices: createEmailMessageDto.to,
            use_auto_registration: true,
            subject: [{ default: createEmailMessageDto.subject }],
            dynamic_content_placeholders: createEmailMessageDto.substitutions,
            from: { name: this.fromName, email: this.fromEmail },
          },
        },
      });
    } catch (error) {
      this.httpErrorFactory.from(error);
    }
  }
}
