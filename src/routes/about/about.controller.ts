import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AboutService } from '@/routes/about/about.service';
import { About } from '@/routes/about/entities/about.entity';

@ApiTags('about')
@Controller({ path: 'about' })
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @ApiOkResponse({ type: About })
  @Get()
  getAbout(): About {
    return this.aboutService.getAbout();
  }
}
