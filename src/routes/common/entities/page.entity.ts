import { ApiProperty } from '@nestjs/swagger';
import { Page as DomainPage } from '../../../domain/entities/page.entity';

/**
 * The SwaggerModule cannot generate model definitions based on Generics
 *
 * Therefore, a specific implementation of this class is required in order
 * to generate the correct OpenApi stubs.
 *
 * eg.: In order to represent on a route that it returns a {@link Page} of
 * {@link Chain} you can create a ChainPage which extends this one while
 * specifying T as Chain.
 *
 * The route would then specify @ApiOkResponse({ type: ChainPage }) as the
 * return type
 */
export abstract class Page<T> implements DomainPage<T> {
  @ApiProperty()
  count: number;
  @ApiProperty()
  next: string;
  @ApiProperty()
  previous: string;
  abstract results: T[];
}
