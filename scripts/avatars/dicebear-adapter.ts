import { Avatar, Style } from '@dicebear/core';
import type { GeneratorRecipe, TagKey } from '../../src/lib/contracts/avatar';
import { PALETTE, type StyleConfig } from './config';
import { normalizeSvg, validatePublishedSvg } from './svg-validator';

export interface GeneratedDiceBearAsset {
  bytes: Uint8Array;
  width: number;
  height: number;
  tags: readonly TagKey[];
  alt: string;
}

export function generateDiceBearAsset(
  recipe: GeneratorRecipe,
  config: StyleConfig,
): GeneratedDiceBearAsset {
  if (recipe.generatorId !== 'dicebear' || recipe.preset !== config.slug) {
    throw new Error(
      'DiceBear recipe does not match the selected adapter preset.',
    );
  }

  const style = new Style(config.definition);
  const svg = new Avatar(style, recipe.input).toString();
  const validated = validatePublishedSvg(normalizeSvg(svg));

  const tags = deriveTags(recipe, config);
  return {
    ...validated,
    tags,
    alt: describeAvatar(config, tags),
  };
}

function deriveTags(
  recipe: GeneratorRecipe,
  config: StyleConfig,
): readonly TagKey[] {
  const tags: TagKey[] = [
    colorTagFor(recipe.input.backgroundColor),
    'expression:smile',
    `theme:${config.theme}`,
  ];
  const hasGlasses = recipe.input.glassesProbability === 100;
  if (hasGlasses) tags.push('accessory:glasses');
  if (recipe.input.eyesVariant === config.bigEyesVariant) tags.push('eye:big');
  if (config.bald) tags.push('hair:bald');
  if (
    hasGlasses &&
    (config.theme === 'retro' || recipe.input.borderRadius === 12)
  ) {
    tags.push('theme:nerd');
  }
  return [...new Set(tags)].sort();
}

function colorTagFor(
  backgroundColor: string | number | boolean | undefined,
): string {
  const palette = PALETTE.find(({ value }) => value === backgroundColor);
  if (!palette)
    throw new Error('DiceBear recipe uses an unapproved background color.');
  return palette.key;
}

function describeAvatar(config: StyleConfig, tags: readonly TagKey[]): string {
  const traits = [
    tags.includes('accessory:glasses') ? 'glasses' : undefined,
    tags.includes('eye:big') ? 'big eyes' : undefined,
    tags.includes('hair:bald') ? 'a bald silhouette' : undefined,
    tags.find((tag) => tag.startsWith('color:'))?.slice('color:'.length) +
      ' background',
  ].filter((trait): trait is string => Boolean(trait));
  return `${config.name} agent avatar with a smile, ${traits.join(', ')}`;
}
