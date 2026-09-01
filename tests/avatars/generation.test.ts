import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildRecipes, generateCatalog } from '../../scripts/avatars/catalog';
import { buildPremiumFlatCatalog } from '../../scripts/avatars/premium-flat-catalog';
import { mergeGeneratedCatalogs } from '../../scripts/avatars/generate';
import { sha256 } from '../../scripts/avatars/hash';
import {
  normalizeSvg,
  validatePublishedSvg,
} from '../../scripts/avatars/svg-validator';
import { validateManifest } from '../../scripts/avatars/validate';

function stripFragmentNamespaces(bytes: Uint8Array): string {
  const svg = Buffer.from(bytes).toString('utf8');
  const ids = [...svg.matchAll(/\bid=["']([^"']+)["']/giu)].map(
    (match) => match[1],
  );

  let canonical = svg;
  for (const [index, id] of ids.entries()) {
    if (!id) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const replacement = `fragment-${index}`;
    canonical = canonical
      .replace(
        new RegExp(`\\bid=(["'])${escaped}\\1`, 'gu'),
        `id="${replacement}"`,
      )
      .replace(
        new RegExp(`url\\((["']?)#${escaped}\\1\\)`, 'gu'),
        `url(#${replacement})`,
      )
      .replace(
        new RegExp(`(href|xlink:href)=(["'])#${escaped}\\2`, 'gu'),
        `$1="#${replacement}"`,
      );
  }
  return canonical;
}

describe('avatar generation', () => {
  it('builds exactly 504 deterministic recipes without personal data', () => {
    const recipes = buildRecipes();

    expect(recipes).toHaveLength(504);
    expect(new Set(recipes.map((recipe) => recipe.input.seed)).size).toBe(504);
    expect(JSON.stringify(recipes)).not.toMatch(/@|email|user[-_]?id/i);
  });

  it('produces byte-identical catalog output for identical inputs', () => {
    const first = generateCatalog({ avatarsPerStyle: 1 });
    const second = generateCatalog({ avatarsPerStyle: 1 });

    expect(first.manifest).toEqual(second.manifest);
    expect(first.recipes).toEqual(second.recipes);
    expect([...first.assets.entries()]).toEqual([...second.assets.entries()]);
  });

  it('keeps engine recipes private while publishing searchable metadata', () => {
    const catalog = generateCatalog({ avatarsPerStyle: 1 });
    const serialized = JSON.stringify(catalog.manifest);

    expect(catalog.manifest.avatars).toHaveLength(6);
    expect(catalog.manifest.schemaVersion).toBe(1);
    expect(catalog.manifest.rights[0]?.spdxExpression).toBe('CC0-1.0');
    expect(catalog.manifest.tagDefinitions.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'accessory:glasses',
        'color:yellow',
        'expression:smile',
        'eye:big',
        'hair:bald',
        'theme:nerd',
      ]),
    );
    expect(serialized).not.toContain('seed');
    expect(serialized).not.toContain('glassesVariant');
  });

  it('excludes visually duplicate SVGs from the deployed catalog', () => {
    const catalog = generateCatalog();
    const visualSignatures = [...catalog.assets.values()].map((bytes) =>
      stripFragmentNamespaces(bytes),
    );

    expect(new Set(visualSignatures).size).toBe(visualSignatures.length);
    expect(catalog.manifest.avatars).toHaveLength(501);
  });
});

describe('manifest validation', () => {
  it('accepts generated assets and rejects a mismatched hash', async () => {
    const catalog = generateCatalog({ avatarsPerStyle: 1 });
    const readAsset = (assetPath: string) => catalog.assets.get(assetPath);

    await expect(
      validateManifest(catalog.manifest, readAsset, { minimumAvatars: 6 }),
    ).resolves.toEqual(catalog.manifest);

    const [first, ...rest] = catalog.manifest.avatars;
    if (!first) throw new Error('Expected a generated avatar.');

    const invalid = {
      ...catalog.manifest,
      avatars: [{ ...first, assetSha256: '0'.repeat(64) }, ...rest],
    };

    await expect(
      validateManifest(invalid, readAsset, { minimumAvatars: 6 }),
    ).rejects.toThrow(/hash/i);
  });

  it('rejects published rights that do not allow every catalog action', async () => {
    const catalog = generateCatalog({ avatarsPerStyle: 1 });
    const readAsset = (assetPath: string) => catalog.assets.get(assetPath);
    const restricted = {
      ...catalog.manifest,
      rights: catalog.manifest.rights.map((rights) => ({
        ...rights,
        modificationsAllowed: false,
      })),
    };

    await expect(
      validateManifest(restricted, readAsset, { minimumAvatars: 6 }),
    ).rejects.toThrow(
      /rights.*download.*redistribution.*commercial.*modification/i,
    );
  });
});

describe('Premium Flat public catalog', () => {
  it('publishes all 256 owned samples with validated provenance', async () => {
    const catalog = await buildPremiumFlatCatalog(async (filename) =>
      readFile(new URL(`../../public/avatars/${filename}`, import.meta.url)),
    );
    const readAsset = (assetPath: string) => catalog.assets.get(assetPath);

    expect(catalog.manifest.avatars).toHaveLength(256);
    expect(catalog.manifest.generators).toEqual([
      expect.objectContaining({ id: 'premium-flat' }),
    ]);
    expect(catalog.manifest.rights).toEqual([
      expect.objectContaining({
        id: 'premium-flat-owned-v1',
        basis: 'owned',
        redistributionAllowed: true,
        commercialUseAllowed: true,
        modificationsAllowed: true,
      }),
    ]);
    const rightsReview = await readFile(
      new URL(
        '../../generated/rights/premium-flat-owned-review.txt',
        import.meta.url,
      ),
    );
    expect(catalog.manifest.rights[0]?.reviewedSourceSha256).toBe(
      sha256(rightsReview),
    );
    expect(new Set(catalog.assets).size).toBe(256);
    await expect(
      validateManifest(catalog.manifest, readAsset, { minimumAvatars: 256 }),
    ).resolves.toEqual(catalog.manifest);
  });

  it('merges Premium Flat samples with unique DiceBear avatars', async () => {
    const dicebear = generateCatalog({ avatarsPerStyle: 1 });
    const premiumFlat = await buildPremiumFlatCatalog(async (filename) =>
      readFile(new URL(`../../public/avatars/${filename}`, import.meta.url)),
    );
    const catalog = mergeGeneratedCatalogs([dicebear, premiumFlat]);
    const readAsset = (assetPath: string) => catalog.assets.get(assetPath);

    expect(catalog.manifest.avatars).toHaveLength(262);
    expect(catalog.manifest.generators.map(({ id }) => id)).toEqual([
      'dicebear',
      'premium-flat',
    ]);
    await expect(
      validateManifest(catalog.manifest, readAsset, { minimumAvatars: 262 }),
    ).resolves.toEqual(catalog.manifest);
  });
});

describe('SVG publication safety', () => {
  it('normalizes DiceBear mask CSS into a static presentation attribute', () => {
    for (const maskType of ['alpha', 'luminance']) {
      const normalized = normalizeSvg(
        `<svg width="1" height="1" viewBox="0 0 1 1"><mask id="m" style="mask-type:${maskType}"><rect width="1" height="1" /></mask></svg>`,
      );

      expect(Buffer.from(normalized).toString('utf8')).toContain(
        `mask-type="${maskType}"`,
      );
      expect(() => validatePublishedSvg(normalized)).not.toThrow();
    }
  });

  it('rejects scripts, event handlers, and external references', () => {
    expect(() =>
      validatePublishedSvg(
        Buffer.from('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>'),
      ),
    ).toThrow(/script/i);
    expect(() =>
      validatePublishedSvg(
        Buffer.from('<svg viewBox="0 0 1 1"><path onload="x" /></svg>'),
      ),
    ).toThrow(/event/i);
    expect(() =>
      validatePublishedSvg(
        Buffer.from(
          '<svg viewBox="0 0 1 1"><use href="https://evil.example/x" /></svg>',
        ),
      ),
    ).toThrow(/reference/i);
  });
});
