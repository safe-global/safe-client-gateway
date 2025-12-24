import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { ShareService } from '@/modules/share/routes/share.service';

@Controller({ path: 'share', version: '1' })
@ApiExcludeController()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('tx')
  @Header('Content-Type', 'text/html')
  async getTransactionShare(
    @Query('safe') safe: string,
    @Query('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.shareService.generateTransactionHtml(safe, id);
    res.send(html);
  }

  @Get('tx/image')
  @Header('Cache-Control', 'public, max-age=3600')
  async getTransactionImage(
    @Query('safe') safe: string,
    @Query('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { image, contentType } =
      await this.shareService.generateTransactionImage(safe, id);
    res.setHeader('Content-Type', contentType);
    res.send(image);
  }
}

