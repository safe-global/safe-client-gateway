import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../config/configuration.service.interface';
import { About } from './entities/about.entity';

@Injectable()
export class AboutService {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  getAbout(): About {
    return {
      name: this.configurationService.getOrThrow<string>('about.name'),
      version: this.configurationService.getOrThrow<string>('about.version'),
      buildNumber:
        this.configurationService.getOrThrow<string>('about.buildNumber'),
    };
  }
}
