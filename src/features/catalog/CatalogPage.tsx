import { useMemo, useState, type FormEvent } from 'react';
import type {
  AvatarManifest,
  AvatarRecord,
  TagKey,
} from '../../lib/contracts/avatar';
import { copyAvatarLink, downloadAvatar, openAvatar } from './actions';
import { AvatarCard } from './AvatarCard';
import { CatalogControls } from './CatalogControls';
import { filterAvatars } from './search';
import { parseCatalogQuery, serializeCatalogQuery } from './url-state';
import { AccountControls } from '../identity/AccountControls';
import { useOptionalCollections } from '../collections/collections-context';

interface CatalogPageProps {
  manifest: AvatarManifest;
  publicSiteOrigin: string;
}

interface ActionFeedback {
  message: string;
  fallbackUrl?: string;
}

export function CatalogPage({ manifest, publicSiteOrigin }: CatalogPageProps) {
  const collections = useOptionalCollections();
  const knownTags = useMemo(
    () => new Set(manifest.tagDefinitions.map(({ key }) => key)),
    [manifest.tagDefinitions],
  );
  const initialState = useMemo(
    () => parseCatalogQuery(window.location.search, knownTags),
    [knownTags],
  );
  const [query, setQuery] = useState(initialState.query);
  const [draftQuery, setDraftQuery] = useState(initialState.query);
  const [selectedTags, setSelectedTags] = useState(initialState.tags);
  const [favoritesOnly, setFavoritesOnly] = useState(
    Boolean(initialState.favoritesOnly),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({ message: '' });
  const [busyAction, setBusyAction] = useState('');
  const tagDefinitions = useMemo(
    () => new Map(manifest.tagDefinitions.map((tag) => [tag.key, tag])),
    [manifest.tagDefinitions],
  );
  const results = useMemo(() => {
    const filtered = filterAvatars(
      manifest.avatars,
      manifest,
      query,
      selectedTags,
    );
    if (!(favoritesOnly && collections?.authenticated)) return filtered;
    return filtered.filter(({ id }) => collections.favoriteIds.has(id));
  }, [collections, favoritesOnly, manifest, query, selectedTags]);

  function updateUrl(
    nextQuery: string,
    nextTags: readonly TagKey[],
    nextFavoritesOnly = favoritesOnly,
  ): void {
    const search = serializeCatalogQuery({
      query: nextQuery,
      tags: nextTags,
      favoritesOnly: nextFavoritesOnly,
    });
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${search}`,
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    setQuery(nextQuery);
    updateUrl(nextQuery, selectedTags);
  }

  function toggleTag(tag: TagKey): void {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selected) => selected !== tag)
      : [...selectedTags, tag].sort();
    setSelectedTags(nextTags);
    updateUrl(query, nextTags);
  }

  function reset(): void {
    setDraftQuery('');
    setQuery('');
    setSelectedTags([]);
    updateUrl('', [], favoritesOnly);
  }

  async function handleDownload(avatar: AvatarRecord): Promise<void> {
    setBusyAction(`${avatar.id}:download`);
    const result = await downloadAvatar(avatar);
    setBusyAction('');
    setFeedback({
      message:
        result.status === 'downloaded'
          ? `Downloaded ${avatar.alt}.`
          : `Download failed for ${avatar.alt}. The published file did not pass verification.`,
    });
  }

  function handleOpen(avatar: AvatarRecord): void {
    const result = openAvatar(
      avatar,
      publicSiteOrigin,
      window.open.bind(window),
    );
    setFeedback({
      message:
        result.status === 'opened'
          ? `Opened ${avatar.alt} in a new window.`
          : `Could not open ${avatar.alt}. Allow popups and try again.`,
    });
  }

  async function handleCopy(avatar: AvatarRecord): Promise<void> {
    const clipboard = navigator.clipboard ?? {
      writeText: () => Promise.reject(new Error('Clipboard unavailable.')),
    };
    const result = await copyAvatarLink(avatar, publicSiteOrigin, clipboard);
    setFeedback(
      result.status === 'copied'
        ? { message: `Copied the link for ${avatar.alt}.` }
        : {
            message: `Clipboard access is unavailable. Select and copy the link for ${avatar.alt}.`,
            fallbackUrl: result.url,
          },
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Agent Avatars home">
          <span className="brand-mark" aria-hidden="true">
            AA
          </span>
          Agent Avatars
        </a>
        <AccountControls />
      </header>

      <div className="page-shell">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">504 deterministic portraits · CC0 artwork</p>
          <h1 id="page-title">Give every agent a memorable face.</h1>
          <p>
            Search a ready-to-use collection, combine visible traits, and take
            the exact same avatar wherever your agent works.
          </p>
        </section>

        <CatalogControls
          draftQuery={draftQuery}
          selectedTags={selectedTags}
          tagDefinitions={manifest.tagDefinitions}
          resultCount={results.length}
          onDraftQueryChange={setDraftQuery}
          onSubmit={submitSearch}
          onToggleTag={toggleTag}
          onReset={reset}
        />

        {collections?.authenticated ? (
          <div className="collection-toolbar">
            <button
              className="button button-secondary"
              type="button"
              aria-pressed={favoritesOnly}
              disabled={collections.favoriteStatus === 'loading'}
              onClick={() => {
                const nextValue = !favoritesOnly;
                setFavoritesOnly(nextValue);
                updateUrl(query, selectedTags, nextValue);
              }}
            >
              Saved avatars ({collections.favoriteIds.size})
            </button>
          </div>
        ) : null}

        {collections?.message ? (
          <div
            className="collection-feedback"
            role="alert"
            aria-label="Collection update"
          >
            {collections.message}
          </div>
        ) : null}

        <div className="action-feedback" role="status" aria-live="polite">
          {feedback.message ? <p>{feedback.message}</p> : null}
          {feedback.fallbackUrl ? (
            <div className="copy-fallback">
              <label htmlFor="copy-fallback">Canonical avatar link</label>
              <input
                id="copy-fallback"
                value={feedback.fallbackUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          ) : null}
        </div>

        {results.length > 0 ? (
          <ul className="avatar-grid" aria-label="Avatar catalog">
            {results.map((avatar) => (
              <AvatarCard
                key={avatar.id}
                avatar={avatar}
                tagDefinitions={tagDefinitions}
                busyAction={
                  busyAction.startsWith(`${avatar.id}:`)
                    ? busyAction.slice(avatar.id.length + 1)
                    : undefined
                }
                onDownload={(record) => void handleDownload(record)}
                onOpen={handleOpen}
                onCopy={(record) => void handleCopy(record)}
                isFavorite={collections?.favoriteIds.has(avatar.id)}
                favoriteBusy={collections?.busyFavoriteIds.has(avatar.id)}
                onToggleFavorite={
                  collections?.authenticated &&
                  collections.favoriteStatus === 'ready'
                    ? (record, label) =>
                        void collections.toggleFavorite(record.id, label)
                    : undefined
                }
              />
            ))}
          </ul>
        ) : (
          <section className="empty-state" aria-labelledby="empty-title">
            <p className="empty-symbol" aria-hidden="true">
              0
            </p>
            <h2 id="empty-title">No avatars match those filters.</h2>
            <p>
              {favoritesOnly && collections?.authenticated
                ? 'Save an avatar to find it here, or show the full catalog.'
                : 'Try fewer traits or a broader search.'}
            </p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                if (favoritesOnly && collections?.authenticated) {
                  setFavoritesOnly(false);
                  updateUrl(query, selectedTags, false);
                } else {
                  reset();
                }
              }}
            >
              {favoritesOnly && collections?.authenticated
                ? 'Show all avatars'
                : 'Reset filters'}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
