import { describe, expect, it } from 'vitest';
import {
  assertPartPackPublishable,
  combinationCount,
  recipeAt,
  validatePartPack,
} from '../../scripts/avatar-parts/part-pack';
import { composeAvatar } from '../../scripts/avatar-parts/composer';
import { sampleRecipeIndexes } from '../../scripts/avatar-parts/generate';
import {
  buildPremiumFlatPack,
  normalizePremiumFlatAvatar,
} from '../../scripts/avatar-parts/premium-flat-pack';

const fixturePack = {
  schemaVersion: 1,
  id: 'fixture-parts',
  name: 'Fixture parts',
  publication: {
    status: 'local-only',
    reason: 'Synthetic fixture is not a catalog source.',
  },
  canvas: { width: 256, height: 256 },
  slots: [
    {
      id: 'background',
      optional: false,
      variants: [
        { id: 'blue', kind: 'color', value: '#2563eb' },
        { id: 'pink', kind: 'color', value: '#db2777' },
      ],
    },
    {
      id: 'base',
      optional: false,
      variants: [
        {
          id: 'round',
          kind: 'svg',
          markup:
            '<svg viewBox="0 0 10 10"><defs><clipPath id="face"><circle cx="5" cy="5" r="4" /></clipPath></defs><g clip-path="url(#face)"><rect width="10" height="10" fill="#f2b38f" /></g></svg>',
        },
        {
          id: 'square',
          kind: 'svg',
          markup:
            '<svg viewBox="0 0 10 10"><rect width="10" height="10" rx="2" fill="#f2b38f" /></svg>',
        },
        {
          id: 'diamond',
          kind: 'svg',
          markup:
            '<svg viewBox="0 0 10 10"><path d="M5 0 10 5 5 10 0 5Z" fill="#f2b38f" /></svg>',
        },
      ],
    },
    {
      id: 'accessory',
      optional: true,
      variants: [
        {
          id: 'glasses',
          kind: 'svg',
          markup:
            '<svg viewBox="0 0 10 10"><path d="M1 4h3v2H1Zm5 0h3v2H6Z" fill="#111827" /></svg>',
        },
      ],
    },
  ],
} as const;

describe('avatar part pack composition', () => {
  it('validates one versioned contract and rejects path-like IDs', () => {
    expect(validatePartPack(fixturePack)).toEqual(fixturePack);
    expect(() =>
      validatePartPack({ ...fixturePack, id: '../fixture-parts' }),
    ).toThrow(/id/i);
  });

  it('keeps local-only packs out of the public catalog', () => {
    const pack = validatePartPack(fixturePack);

    expect(() => assertPartPackPublishable(pack)).toThrow(/local-only/i);
  });

  it('counts combinations without expanding the cartesian product', () => {
    const pack = validatePartPack(fixturePack);

    expect(combinationCount(pack)).toBe(12n);
    expect(recipeAt(pack, 0n)).toEqual({
      schemaVersion: 1,
      packId: 'fixture-parts',
      selections: {
        accessory: null,
        background: 'blue',
        base: 'round',
      },
    });
    expect(recipeAt(pack, 11n)).toEqual({
      schemaVersion: 1,
      packId: 'fixture-parts',
      selections: {
        accessory: 'glasses',
        background: 'pink',
        base: 'diamond',
      },
    });
    expect(() => recipeAt(pack, 12n)).toThrow(/range/i);
  });

  it('composes deterministic, publication-safe SVG and namespaces fragment IDs', () => {
    const pack = validatePartPack(fixturePack);
    const recipe = recipeAt(pack, 1n);
    const first = composeAvatar(pack, recipe);
    const second = composeAvatar(pack, recipe);
    const svg = Buffer.from(first.bytes).toString('utf8');

    expect(first).toEqual(second);
    expect(first.width).toBe(256);
    expect(first.height).toBe(256);
    expect(svg).toContain('id="base-round-face"');
    expect(svg).toContain('url(#base-round-face)');
  });

  it('samples the full combination space instead of clustering at the start', () => {
    expect(sampleRecipeIndexes(90_720n, 5)).toEqual([
      0n,
      22_679n,
      45_359n,
      68_039n,
      90_719n,
    ]);
    expect(() => sampleRecipeIndexes(100_000n, 10_001)).toThrow(/10000/);
  });

  it('rejects active markup at the part-pack boundary', () => {
    expect(() =>
      validatePartPack({
        ...fixturePack,
        slots: [
          {
            id: 'base',
            optional: false,
            variants: [
              {
                id: 'unsafe',
                kind: 'svg',
                markup: '<svg viewBox="0 0 1 1"><script /></svg>',
              },
            ],
          },
        ],
      }),
    ).toThrow(/script/i);
  });
});

describe('Premium Flat source migration', () => {
  it('normalizes an extracted Illustrator avatar into a safe square-canvas part', () => {
    const source = [
      '<?xml version="1.0"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="100" height="200" viewBox="0 0 100 200" aria-labelledby="title desc">',
      '<title id="title">Character</title><desc id="desc">Source</desc>',
      '<g id="avatar" inkscape:groupmode="layer"><path d="M0 0h100v200H0Z" fill="#f2b38f" /></g>',
      '</svg>',
    ].join('');

    const normalized = normalizePremiumFlatAvatar(source);

    expect(normalized).toContain('viewBox="0 0 100 200"');
    expect(normalized).toContain('width="110" height="220"');
    expect(normalized).not.toMatch(
      /<\?xml|<title|<desc|inkscape|aria-labelledby/i,
    );
  });

  it('builds a rights-gated 20-base pack with 90,720 combinations', () => {
    const bases = Array.from(
      { length: 20 },
      (_, index) =>
        `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="${index + 1}" /></svg>`,
    );
    const pack = buildPremiumFlatPack(bases);

    expect(pack.publication.status).toBe('local-only');
    expect(pack.slots.find(({ id }) => id === 'base')?.variants).toHaveLength(
      20,
    );
    expect(combinationCount(pack)).toBe(90_720n);
  });
});
