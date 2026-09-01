import { z } from 'zod';

const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const MAX_PART_MARKUP_BYTES = 1024 * 1024;

const colorVariantSchema = z.object({
  id: idSchema,
  kind: z.literal('color'),
  value: colorSchema,
});

const svgVariantSchema = z.object({
  id: idSchema,
  kind: z.literal('svg'),
  markup: z
    .string()
    .min(1)
    .max(MAX_PART_MARKUP_BYTES)
    .superRefine((markup, context) => {
      try {
        validatePartSvgMarkup(markup);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Invalid SVG part.',
        });
      }
    }),
});

const partSlotSchema = z.object({
  id: idSchema,
  optional: z.boolean(),
  variants: z
    .array(z.discriminatedUnion('kind', [colorVariantSchema, svgVariantSchema]))
    .min(1),
});

const publicationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('local-only'),
    reason: z.string().min(1),
  }),
  z.object({
    status: z.literal('approved'),
    rightsId: idSchema,
    reviewRef: z.string().min(1),
  }),
]);

export const avatarPartPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    name: z.string().min(1),
    publication: publicationSchema,
    canvas: z.object({
      width: z.number().int().positive().max(2048),
      height: z.number().int().positive().max(2048),
    }),
    slots: z.array(partSlotSchema).min(1),
  })
  .superRefine((pack, context) => {
    if (pack.canvas.width !== pack.canvas.height) {
      context.addIssue({
        code: 'custom',
        message: 'Avatar part-pack canvas must be square.',
        path: ['canvas'],
      });
    }

    addDuplicateIssues(
      pack.slots.map(({ id }) => id),
      ['slots'],
      'slot ID',
      context,
    );
    for (const [index, slot] of pack.slots.entries()) {
      addDuplicateIssues(
        slot.variants.map(({ id }) => id),
        ['slots', index, 'variants'],
        'variant ID',
        context,
      );
    }
  });

export type AvatarPartPack = z.infer<typeof avatarPartPackSchema>;
export type AvatarPartSlot = AvatarPartPack['slots'][number];
export type AvatarPartVariant = AvatarPartSlot['variants'][number];

export interface AvatarPartRecipe {
  schemaVersion: 1;
  packId: string;
  selections: Readonly<Record<string, string | null>>;
}

export function validatePartPack(input: unknown): AvatarPartPack {
  return avatarPartPackSchema.parse(input);
}

export function assertPartPackPublishable(pack: AvatarPartPack): void {
  if (pack.publication.status === 'local-only') {
    throw new Error(
      `Part pack ${pack.id} is local-only: ${pack.publication.reason}`,
    );
  }
}

export function combinationCount(pack: AvatarPartPack): bigint {
  return pack.slots.reduce(
    (total, slot) =>
      total * BigInt(slot.variants.length + (slot.optional ? 1 : 0)),
    1n,
  );
}

export function recipeAt(
  pack: AvatarPartPack,
  requestedIndex: bigint,
): AvatarPartRecipe {
  const total = combinationCount(pack);
  if (requestedIndex < 0n || requestedIndex >= total) {
    throw new RangeError(
      `Part recipe index ${requestedIndex} is outside the range 0-${total - 1n}.`,
    );
  }

  let index = requestedIndex;
  const selections = new Map<string, string | null>();
  for (const slot of pack.slots) {
    const radix = BigInt(slot.variants.length + (slot.optional ? 1 : 0));
    const variantIndex = Number(index % radix);
    index /= radix;
    selections.set(
      slot.id,
      slot.optional && variantIndex === 0
        ? null
        : (slot.variants[variantIndex - (slot.optional ? 1 : 0)]?.id ?? null),
    );
  }

  return {
    schemaVersion: 1,
    packId: pack.id,
    selections: Object.fromEntries(
      [...selections.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}

function addDuplicateIssues(
  values: readonly string[],
  path: readonly (string | number)[],
  label: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate ${label}: ${value}.`,
        path: [...path, index],
      });
    }
    seen.add(value);
  }
}

function validatePartSvgMarkup(markup: string): void {
  const trimmed = markup.trim();
  if (!/^<svg\b/iu.test(trimmed) || !/<\/svg>$/iu.test(trimmed)) {
    throw new Error('SVG part markup must be one complete svg element.');
  }

  const forbiddenPatterns: readonly [RegExp, string][] = [
    [/<\s*script\b/iu, 'SVG part script elements are forbidden.'],
    [/<!\s*(doctype|entity)\b/iu, 'SVG part declarations are forbidden.'],
    [/<\s*foreignObject\b/iu, 'SVG part foreignObject is forbidden.'],
    [/<\s*style\b|\sstyle\s*=/iu, 'SVG part CSS is forbidden.'],
    [/<\s*(animate|set|filter)\b/iu, 'SVG part animation is forbidden.'],
    [/\son[a-z]+\s*=/iu, 'SVG part event attributes are forbidden.'],
    [/\b(?:javascript|data):/iu, 'SVG part active data is forbidden.'],
  ];
  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(trimmed)) throw new Error(message);
  }

  for (const match of trimmed.matchAll(
    /(?:href|xlink:href)\s*=\s*["']([^"']+)["']/giu,
  )) {
    if (!match[1]?.startsWith('#')) {
      throw new Error('SVG part references must stay inside the document.');
    }
  }
  for (const match of trimmed.matchAll(/url\(([^)]+)\)/giu)) {
    const value = match[1]?.trim().replace(/^["']|["']$/gu, '');
    if (!value?.startsWith('#')) {
      throw new Error('SVG part URL references must stay inside the document.');
    }
  }
}
