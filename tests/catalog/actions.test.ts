import { describe, expect, it, vi } from 'vitest';
import type { AvatarRecord } from '../../src/lib/contracts/avatar';
import {
  canonicalAssetUrl,
  copyAvatarLink,
  downloadAvatar,
  openAvatar,
} from '../../src/features/catalog/actions';

const record: AvatarRecord = {
  id: 'dicebear-aaaaaaaaaaaaaaaaaaaa',
  generatorId: 'dicebear',
  preset: 'lorelei',
  assetPath: '/avatars/dicebear-aaaaaaaaaaaaaaaaaaaa.svg',
  assetExtension: 'svg',
  mediaType: 'image/svg+xml',
  assetSha256:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  width: 256,
  height: 256,
  alt: 'Smiling agent with glasses',
  tags: ['accessory:glasses', 'expression:smile'],
  rightsId: 'dicebear-cc0-1-0',
  provenanceId: 'dicebear-provenance-aaaaaaaaaaaaaaaaaaaa',
};

describe('avatar actions', () => {
  it('builds the canonical URL from the public origin and manifest path', () => {
    expect(canonicalAssetUrl(record, 'https://agent-avatars.dev')).toBe(
      'https://agent-avatars.dev/avatars/dicebear-aaaaaaaaaaaaaaaaaaaa.svg',
    );
  });

  it('copies only the canonical URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(
      copyAvatarLink(record, 'https://agent-avatars.dev', { writeText }),
    ).resolves.toEqual({ status: 'copied' });
    expect(writeText).toHaveBeenCalledWith(
      'https://agent-avatars.dev/avatars/dicebear-aaaaaaaaaaaaaaaaaaaa.svg',
    );
  });

  it('reports a fallback when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));

    await expect(
      copyAvatarLink(record, 'https://agent-avatars.dev', { writeText }),
    ).resolves.toEqual({
      status: 'fallback',
      url: 'https://agent-avatars.dev/avatars/dicebear-aaaaaaaaaaaaaaaaaaaa.svg',
    });
  });

  it('opens a new isolated browsing context and reports blocked popups', () => {
    const open = vi.fn().mockReturnValue({ opener: window });
    expect(openAvatar(record, 'https://agent-avatars.dev', open)).toEqual({
      status: 'opened',
    });
    expect(open).toHaveBeenCalledWith(
      'https://agent-avatars.dev/avatars/dicebear-aaaaaaaaaaaaaaaaaaaa.svg',
      '_blank',
      'noopener,noreferrer',
    );

    expect(openAvatar(record, 'https://agent-avatars.dev', () => null)).toEqual(
      { status: 'blocked' },
    );
  });

  it('refuses a download whose bytes do not match the manifest hash', async () => {
    const click = vi.fn();
    const fetchAsset = vi.fn().mockResolvedValue(
      new Response('<svg width="1" height="1"></svg>', {
        headers: { 'content-type': 'image/svg+xml' },
      }),
    );

    await expect(
      downloadAvatar(record, {
        fetchAsset,
        clickDownload: click,
      }),
    ).resolves.toEqual({ status: 'error' });
    expect(click).not.toHaveBeenCalled();
  });
});
