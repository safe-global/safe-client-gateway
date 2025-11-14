import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AboutService } from '@/modules/about/routes/about.service';
import { About } from '@/modules/about/routes/entities/about.entity';

@ApiTags('about')
@Controller({ path: 'about' })
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @ApiOperation({
    summary: 'Get application information',
    description:
      'Retrieves basic information about the Safe Client Gateway application including version and build details.',
  })
  @ApiOkResponse({
    type: About,
    description: 'Application information retrieved successfully',
  })
  @Get()
  getAbout(): About {
    return this.aboutService.getAbout();
  }
}
