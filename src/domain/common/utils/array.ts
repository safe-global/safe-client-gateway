import type { GetFieldType } from 'lodash';
import get from 'lodash/get';

export function getFirstAvailable<TObject, TPath extends string>(
  sourceObject: TObject,
  paths: Array<string>,
): GetFieldType<TObject, TPath> | undefined {
  for (const path of paths) {
    const value = get(sourceObject, path);
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}
