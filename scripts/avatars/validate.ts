import {
  avatarManifestSchema,
  type AvatarManifest,
} from '../../src/lib/contracts/avatar';
import { sha256 } from './hash';
import { validatePublishedSvg } from './svg-validator';

export async function validateManifest(
  input: unknown,
  readAsset: (
    assetPath: string,
  ) => Promise<Uint8Array | undefined> | Uint8Array | undefined,
  options: { minimumAvatars?: number } = {},
): Promise<AvatarManifest> {
  const manifest = avatarManifestSchema.parse(input);
  const minimum = options.minimumAvatars ?? 500;
  if (manifest.avatars.length < minimum) {
    throw new Error(`Manifest must contain at least ${minimum} avatars.`);
  }

  assertSortedUnique(
    manifest.generators.map(({ id }) => id),
    'generator IDs',
  );
  assertSortedUnique(
    manifest.rights.map(({ id }) => id),
    'rights IDs',
  );
  assertSortedUnique(
    manifest.provenance.map(({ id }) => id),
    'provenance IDs',
  );
  assertSortedUnique(
    manifest.tagDefinitions.map(({ key }) => key),
    'tag definitions',
  );
  assertSortedUnique(
    manifest.avatars.map(({ id }) => id),
    'avatar IDs',
  );
  assertSortedUnique(
    manifest.avatars.map(({ assetPath }) => assetPath),
    'asset paths',
  );

  const generatorIds = new Set(manifest.generators.map(({ id }) => id));
  const rightsIds = new Set(manifest.rights.map(({ id }) => id));
  const tagKeys = new Set(manifest.tagDefinitions.map(({ key }) => key));
  const provenanceById = new Map(
    manifest.provenance.map((record) => [record.id, record]),
  );

  for (const record of manifest.avatars) {
    if (!generatorIds.has(record.generatorId)) {
      throw new Error(`Avatar ${record.id} has an unknown generator.`);
    }
    if (!rightsIds.has(record.rightsId)) {
      throw new Error(`Avatar ${record.id} has unknown rights.`);
    }
    if (!record.tags.every((tag) => tagKeys.has(tag))) {
      throw new Error(`Avatar ${record.id} has an unknown tag.`);
    }
    assertSortedUnique(record.tags, `tags for ${record.id}`);

    const provenance = provenanceById.get(record.provenanceId);
    if (!provenance || provenance.assetSha256 !== record.assetSha256) {
      throw new Error(`Avatar ${record.id} has a provenance hash mismatch.`);
    }

    const bytes = await readAsset(record.assetPath);
    if (!bytes) throw new Error(`Asset is missing for ${record.id}.`);
    if (sha256(bytes) !== record.assetSha256) {
      throw new Error(`Asset hash mismatch for ${record.id}.`);
    }
    const svg = validatePublishedSvg(bytes);
    if (
      record.mediaType !== 'image/svg+xml' ||
      record.assetExtension !== 'svg' ||
      svg.width !== record.width ||
      svg.height !== record.height
    ) {
      throw new Error(`Asset media metadata mismatch for ${record.id}.`);
    }
    if (!record.id.endsWith(record.assetSha256.slice(0, 20))) {
      throw new Error(`Content-addressed ID mismatch for ${record.id}.`);
    }
  }

  return manifest;
}

function assertSortedUnique(values: readonly string[], label: string): void {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  if (values.some((value, index) => value !== sorted[index])) {
    throw new Error(`${label} must be sorted.`);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must be unique.`);
  }
}
