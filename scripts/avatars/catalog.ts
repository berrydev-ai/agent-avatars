import type {
  AvatarManifest,
  AvatarRecord,
  GeneratorRecipe,
  ProvenanceRecord,
  RightsRecord,
} from '../../src/lib/contracts/avatar';
import { canonicalJson } from './canonical-json';
import { PALETTE, STYLE_CONFIGS, TAG_DEFINITIONS } from './config';
import { generateDiceBearAsset } from './dicebear-adapter';
import { sha256 } from './hash';
import { canonicalizeSvgFragmentIds } from './svg-validator';

const AVATARS_PER_STYLE = 84;
const RIGHTS_REVIEW_SOURCE = [
  'Reviewed 2026-08-27 from https://www.dicebear.com/licenses/.',
  'Lorelei, Lorelei Neutral, Notionists, Notionists Neutral, Pixel Art, and Pixel Art Neutral are listed under CC0 1.0.',
].join('\n');

const rights: RightsRecord = {
  id: 'dicebear-cc0-1-0',
  basis: 'spdx',
  name: 'Creative Commons Zero v1.0 Universal',
  spdxExpression: 'CC0-1.0',
  url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  policyRevision: '2026-08-27',
  reviewedSourceSha256: sha256(RIGHTS_REVIEW_SOURCE),
  attributionRequired: false,
  downloadAllowed: true,
  redistributionAllowed: true,
  commercialUseAllowed: true,
  modificationsAllowed: true,
  reviewedAt: '2026-08-27',
};

export interface GeneratedCatalog {
  manifest: AvatarManifest;
  assets: ReadonlyMap<string, Uint8Array>;
  recipes: readonly GeneratorRecipe[];
  rightsReviewSource: string;
}

export function buildRecipes(
  avatarsPerStyle = AVATARS_PER_STYLE,
): readonly GeneratorRecipe[] {
  return STYLE_CONFIGS.flatMap((config) =>
    Array.from({ length: avatarsPerStyle }, (_, index) => {
      const palette = PALETTE[index % PALETTE.length];
      if (!palette) throw new Error('Avatar palette is empty.');
      const glasses = index % 2 === 0;
      const bigEyes = index % 4 === 0;
      const nerd = glasses && (config.theme === 'retro' || index % 5 === 0);
      const input: Record<string, string | number | boolean> = {
        seed: `agent-avatar-${config.slug}-${String(index + 1).padStart(3, '0')}`,
        size: 256,
        backgroundColor: palette.value,
        glassesProbability: glasses ? 100 : 0,
        mouthVariant: config.smileVariant,
      };
      if (glasses) input.glassesVariant = config.glassesVariant;
      if (bigEyes) input.eyesVariant = config.bigEyesVariant;
      if (nerd) input.borderRadius = 12;

      return {
        schemaVersion: 1 as const,
        generatorId: 'dicebear',
        preset: config.slug,
        input,
      };
    }),
  );
}

export function generateCatalog(
  options: { avatarsPerStyle?: number } = {},
): GeneratedCatalog {
  const recipes = buildRecipes(options.avatarsPerStyle);
  const assets = new Map<string, Uint8Array>();
  const avatars: AvatarRecord[] = [];
  const provenance: ProvenanceRecord[] = [];
  const visualHashes = new Set<string>();

  for (const recipe of recipes) {
    const config = STYLE_CONFIGS.find(({ slug }) => slug === recipe.preset);
    if (!config)
      throw new Error(`Unregistered DiceBear preset: ${recipe.preset}`);
    const generated = generateDiceBearAsset(recipe, config);
    const visualSha256 = sha256(canonicalizeSvgFragmentIds(generated.bytes));
    if (visualHashes.has(visualSha256)) continue;
    visualHashes.add(visualSha256);

    const assetSha256 = sha256(generated.bytes);
    const id = `dicebear-${assetSha256.slice(0, 20)}`;
    const assetPath = `/avatars/${id}.svg`;
    const recipeSha256 = sha256(canonicalJson(recipe));
    const provenanceId = `dicebear-provenance-${assetSha256.slice(0, 20)}`;

    const existing = assets.get(assetPath);
    if (existing && sha256(existing) !== assetSha256) {
      throw new Error(`Content-address prefix collision for ${id}.`);
    }
    assets.set(assetPath, generated.bytes);
    avatars.push({
      id,
      generatorId: 'dicebear',
      preset: recipe.preset,
      assetPath,
      assetExtension: 'svg',
      mediaType: 'image/svg+xml',
      assetSha256,
      width: generated.width,
      height: generated.height,
      alt: generated.alt,
      tags: [...generated.tags],
      rightsId: rights.id,
      provenanceId,
    });
    provenance.push({
      id: provenanceId,
      generatorId: 'dicebear',
      generatorVersion: '10.7.0',
      recipeSchemaVersion: 1,
      recipeSha256,
      assetSha256,
      inputAssetSha256s: [],
      aiGenerated: false,
      sourceUrl: 'https://www.dicebear.com/',
      publicationPolicyId: 'dicebear-cc0-v1',
      publicationPolicyRevision: '2026-08-27',
      approvalRefs: [{ system: 'multica', id: 'BD-11' }],
    });
  }

  avatars.sort((left, right) => left.id.localeCompare(right.id));
  provenance.sort((left, right) => left.id.localeCompare(right.id));

  return {
    manifest: {
      schemaVersion: 1,
      generators: [
        {
          id: 'dicebear',
          adapterApiVersion: 1,
          name: 'DiceBear',
          kind: 'procedural',
          engine: '@dicebear/core',
          engineVersion: '10.7.0',
          components: { '@dicebear/styles': '10.6.0' },
          sourceUrl: 'https://www.dicebear.com/',
          reproducibility: 'deterministic',
          outputMediaTypes: ['image/svg+xml'],
        },
      ],
      rights: [rights],
      provenance,
      tagDefinitions: [...TAG_DEFINITIONS].sort((left, right) =>
        left.key.localeCompare(right.key),
      ),
      avatars,
    },
    assets,
    recipes,
    rightsReviewSource: RIGHTS_REVIEW_SOURCE,
  };
}
