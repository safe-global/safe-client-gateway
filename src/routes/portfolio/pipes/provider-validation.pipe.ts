import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';

@Injectable()
export class ProviderValidationPipe implements PipeTransform {
  transform(value: string): PortfolioProvider {
    const normalized = value?.toLowerCase();

    if (
      !Object.values(PortfolioProvider).includes(
        normalized as PortfolioProvider,
      )
    ) {
      throw new BadRequestException(
        `Invalid provider '${value}'. Must be one of: ${Object.values(PortfolioProvider).join(', ')}`,
      );
    }

    return normalized as PortfolioProvider;
  }
}
