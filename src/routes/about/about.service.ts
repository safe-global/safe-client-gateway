import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { About } from '@/routes/about/entities/about.entity';

@Injectable()
export class AboutService {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  getAbout(): About {
    return {
      name: this.configurationService.getOrThrow<string>('about.name'),
      version: this.configurationService.get<string>('about.version') ?? null,
      buildNumber:
        this.configurationService.get<string>('about.buildNumber') ?? null,
    };
  }
}
