import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Space } from '@/domain/spaces/entities/space.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressBooksService } from '@/routes/spaces/address-books.service';
import { SpaceAddressBookDto } from '@/routes/spaces/entities/space-address-book.dto.entity';
import {
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class AddressBooksController {
  constructor(
    @Inject(AddressBooksService)
    private readonly service: AddressBooksService,
  ) {}

  @ApiOkResponse({ description: 'Address Book Items found' })
  @ApiNotFoundResponse({
    description: 'User, member or space not found',
  })
  @Get('/:spaceId/address-book')
  @UseGuards(AuthGuard)
  public async getAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe) spaceId: Space['id'],
  ): Promise<SpaceAddressBookDto> {
    return this.service.findAllBySpaceId(authPayload, spaceId);
  }
}
