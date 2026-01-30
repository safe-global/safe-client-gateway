import { Module } from '@nestjs/common';
import { CaptchaService } from '@/routes/captcha/captcha.service';
import { CaptchaGuard } from '@/routes/captcha/guards/captcha.guard';

@Module({
  providers: [CaptchaService, CaptchaGuard],
  exports: [CaptchaGuard, CaptchaService],
})
export class CaptchaModule {}
