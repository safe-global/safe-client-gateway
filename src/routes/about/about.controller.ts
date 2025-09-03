import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AboutService } from '@/routes/about/about.service';
import { About } from '@/routes/about/entities/about.entity';

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
