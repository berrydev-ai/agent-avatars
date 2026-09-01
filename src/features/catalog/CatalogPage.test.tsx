import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AvatarManifest, AvatarRecord } from '../../lib/contracts/avatar';
import { CatalogPage } from './CatalogPage';

const manifest: AvatarManifest = {
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
  rights: [],
  provenance: [],
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
    { key: 'theme:nerd', label: 'Nerd', aliases: ['geek', 'geeky'] },
  ],
  avatars: [
    avatar('dicebear-aaaaaaaaaaaaaaaaaaaa', [
      'accessory:glasses',
      'theme:nerd',
    ]),
    avatar('dicebear-bbbbbbbbbbbbbbbbbbbb', ['color:yellow']),
    avatar('dicebear-cccccccccccccccccccc', [
      'accessory:glasses',
      'color:yellow',
    ]),
  ],
};

describe('CatalogPage', () => {
  it('restores URL search state and exposes pressed tag controls', () => {
    window.history.replaceState({}, '', '/?q=geek&tags=accessory%3Aglasses');

    render(
      <CatalogPage
        manifest={manifest}
        publicSiteOrigin="https://agent-avatars.dev"
      />,
    );

    expect(
      screen.getByRole('searchbox', { name: /search avatars/i }),
    ).toHaveValue('geek');
    expect(screen.getByRole('button', { name: 'Glasses' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('1 avatar')).toBeInTheDocument();
    expect(
      screen.getByText('3 deterministic portraits · approved artwork'),
    ).toBeInTheDocument();
    expect(screen.getByText('Approved collection')).toBeInTheDocument();
  });

  it('combines submitted text and tag filters, updates the URL, and resets', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/');
    render(
      <CatalogPage
        manifest={manifest}
        publicSiteOrigin="https://agent-avatars.dev"
      />,
    );

    const search = screen.getByRole('searchbox', { name: /search avatars/i });
    await user.type(search, 'yellow');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await user.click(screen.getByRole('button', { name: 'Glasses' }));

    expect(screen.getByText('1 avatar')).toBeInTheDocument();
    expect(window.location.search).toBe('?q=yellow&tags=accessory%3Aglasses');

    await user.clear(search);
    await user.type(search, 'not present');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(screen.getByText(/no avatars match/i)).toBeInTheDocument();

    const resetButtons = screen.getAllByRole('button', {
      name: /reset filters/i,
    });
    const emptyStateReset = resetButtons.at(-1);
    if (!emptyStateReset)
      throw new Error('Expected an empty-state reset button.');
    await user.click(emptyStateReset);
    expect(screen.getByText('3 avatars')).toBeInTheDocument();
    expect(window.location.search).toBe('');
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
    alt: 'Smiling illustrated agent',
    tags: [...tags].sort(),
    rightsId: 'dicebear-cc0-1-0',
    provenanceId: `dicebear-provenance-${id.slice(-20)}`,
  };
}
