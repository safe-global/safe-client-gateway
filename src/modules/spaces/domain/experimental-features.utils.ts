// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type ExperimentalFeature,
  ExperimentalFeatureSchema,
} from '#/modules/spaces/domain/entities/experimental-feature.entity';

export function isSameFeatureSet(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>,
): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((f) => setB.has(f));
}

// Drops stored values no longer in ExperimentalFeatures
export function toKnownFeatures(
  values: ReadonlyArray<string>,
): Array<ExperimentalFeature> {
  return values.filter(
    (value): value is ExperimentalFeature =>
      ExperimentalFeatureSchema.safeParse(value).success,
  );
}
