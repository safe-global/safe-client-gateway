import { Theme } from '../theme.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';

export function themeBuilder(): IBuilder<Theme> {
  return Builder.new<Theme>()
    .with('textColor', faker.color.rgb())
    .with('backgroundColor', faker.color.rgb());
}
