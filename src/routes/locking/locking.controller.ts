import { LockingEventPage } from '@/routes/locking/entities/locking-event.page.entity';
import { Rank } from '@/routes/locking/entities/rank.entity';
import { RankPage } from '@/routes/locking/entities/rank.page.entity';
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Redirect,
  Req,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('locking')
@Controller({
  path: 'locking',
  version: '1',
})
export class LockingController {
  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: Rank })
  @Redirect(undefined, HttpStatus.PERMANENT_REDIRECT)
  @Get('/leaderboard/rank/:safeAddress')
  getRank(
    @Param('safeAddress')
    safeAddress: `0x${string}`,
  ): { url: string } {
    return { url: `/v1/community/locking/${safeAddress}/rank` };
  }

  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: RankPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Redirect(undefined, HttpStatus.PERMANENT_REDIRECT)
  @Get('/leaderboard')
  getLeaderboard(@Req() request: Request): { url: string } {
    const newUrl = '/v1/community/locking/leaderboard';
    const search = request.url.split('?')[1];
    return {
      url: search ? `${newUrl}/?${search}` : newUrl,
    };
  }

  @ApiOperation({ deprecated: true })
  @ApiOkResponse({ type: LockingEventPage })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
  })
  @Redirect(undefined, HttpStatus.PERMANENT_REDIRECT)
  @Get('/:safeAddress/history')
  getLockingHistory(@Req() request: Request): { url: string } {
    const newUrl = `/v1/community/locking/${request.params.safeAddress}/history`;
    const search = request.url.split('?')[1];
    return {
      url: search ? `${newUrl}/?${search}` : newUrl,
    };
  }
}
