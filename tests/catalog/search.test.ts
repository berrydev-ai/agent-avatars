import { describe, expect, it } from 'vitest';
import type {
  AvatarManifest,
  AvatarRecord,
} from '../../src/lib/contracts/avatar';
import {
  filterAvatars,
  normalizeSearchText,
} from '../../src/features/catalog/search';
import {
  parseCatalogQuery,
  serializeCatalogQuery,
} from '../../src/features/catalog/url-state';

const avatars: readonly AvatarRecord[] = [
  avatar('dicebear-aaaaaaaaaaaaaaaaaaaa', [
    'accessory:glasses',
    'expression:smile',
    'theme:nerd',
  ]),
  avatar('dicebear-bbbbbbbbbbbbbbbbbbbb', ['color:yellow', 'expression:smile']),
  avatar('dicebear-cccccccccccccccccccc', [
    'accessory:glasses',
    'color:yellow',
  ]),
];

const manifest = {
  generators: [
    {
      id: 'dicebear',
      name: 'DiceBear',
    },
  ],
  tagDefinitions: [
    {
      key: 'accessory:glasses',
      label: 'Glasses',
      aliases: ['eyeglasses', 'spectacles'],
    },
    {
      key: 'color:yellow',
      label: 'Yellow',
      aliases: ['gold'],
    },
    {
      key: 'expression:smile',
      label: 'Smile',
      aliases: ['happy', 'smiling'],
    },
    { key: 'theme:nerd', label: 'Nerd', aliases: ['geek', 'geeky'] },
  ],
} as Pick<AvatarManifest, 'generators' | 'tagDefinitions'>;

describe('catalog search', () => {
  it('normalizes case, punctuation, and diacritics', () => {
    expect(normalizeSearchText('  GÉÉKY—Smile! ')).toBe('geeky smile');
  });

  it('combines every text token and selected tag with AND semantics', () => {
    expect(filterAvatars(avatars, manifest, 'geek smiling', [])).toEqual([
      avatars[0],
    ]);
    expect(
      filterAvatars(avatars, manifest, 'smile', ['accessory:glasses']),
    ).toEqual([avatars[0]]);
    expect(
      filterAvatars(avatars, manifest, '', [
        'accessory:glasses',
        'color:yellow',
      ]),
    ).toEqual([avatars[2]]);
  });

  it('preserves manifest order instead of applying relevance sorting', () => {
    expect(filterAvatars(avatars, manifest, '', [])).toEqual(avatars);
  });
});

describe('catalog URL state', () => {
  const knownTags = new Set(manifest.tagDefinitions.map(({ key }) => key));

  it('drops duplicate and unknown tags while sorting canonical keys', () => {
    const parsed = parseCatalogQuery(
      '?q=big+eyes&tags=expression%3Asmile%2Cunknown%3Atag%2Caccessory%3Aglasses%2Cexpression%3Asmile',
      knownTags,
    );

    expect(parsed).toEqual({
      query: 'big eyes',
      tags: ['accessory:glasses', 'expression:smile'],
    });
    expect(serializeCatalogQuery(parsed)).toBe(
      '?q=big+eyes&tags=accessory%3Aglasses%2Cexpression%3Asmile',
    );
  });

  it('omits empty values', () => {
    expect(serializeCatalogQuery({ query: '  ', tags: [] })).toBe('');
  });
});

function avatar(id: string, tags: readonly string[]): AvatarRecord {
  return {
    id,
    generatorId: 'dicebear',
    preset: 'lorelei',
    assetPath: `/avatars/${id}.svg`,
    assetExtension: 'svg',
    mediaType: 'image/svg+xml',
    assetSha256: id.slice(-20).padEnd(64, '0'),
    width: 256,
    height: 256,
    alt: `${id} happy illustrated agent`,
    tags: [...tags].sort(),
    rightsId: 'dicebear-cc0-1-0',
    provenanceId: `dicebear-provenance-${id.slice(-20)}`,
  };
}
