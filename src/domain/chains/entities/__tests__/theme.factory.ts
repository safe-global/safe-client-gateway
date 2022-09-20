/* istanbul ignore file */

import { Theme } from '../theme.entity';
import { faker } from '@faker-js/faker';

export default function (textColor?: string, backgroundColor?: string): Theme {
  return <Theme>{
    textColor: textColor ?? faker.color.rgb(),
    backgroundColor: backgroundColor ?? faker.color.rgb(),
  };
}
