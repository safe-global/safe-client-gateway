import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
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
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

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
  @ApiUnauthorizedResponse({ description: 'Signer address not provided' })
  @ApiForbiddenResponse({ description: 'Signer not authorized.' })
  @Get('/:spaceId/address-book')
  @UseGuards(AuthGuard)
  public async getAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<SpaceAddressBookDto> {
    return this.service.findAllBySpaceId(authPayload, spaceId);
  }
}
