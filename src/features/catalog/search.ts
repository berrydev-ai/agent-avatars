import type {
  AvatarManifest,
  AvatarRecord,
  TagKey,
} from '../../lib/contracts/avatar';

type SearchManifest = Pick<AvatarManifest, 'generators' | 'tagDefinitions'>;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function filterAvatars(
  avatars: readonly AvatarRecord[],
  manifest: SearchManifest,
  query: string,
  selectedTags: readonly TagKey[],
): readonly AvatarRecord[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  const generatorNames = new Map(
    manifest.generators.map(({ id, name }) => [id, name]),
  );
  const tags = new Map(
    manifest.tagDefinitions.map((definition) => [definition.key, definition]),
  );

  return avatars.filter((avatar) => {
    if (!selectedTags.every((tag) => avatar.tags.includes(tag))) return false;
    if (tokens.length === 0) return true;

    const tagText = avatar.tags.flatMap((key) => {
      const definition = tags.get(key);
      return definition ? [definition.label, ...definition.aliases] : [];
    });
    const document = normalizeSearchText(
      [
        avatar.id,
        generatorNames.get(avatar.generatorId) ?? avatar.generatorId,
        avatar.preset,
        avatar.alt,
        ...tagText,
      ].join(' '),
    );
    return tokens.every((token) => document.includes(token));
  });
}
