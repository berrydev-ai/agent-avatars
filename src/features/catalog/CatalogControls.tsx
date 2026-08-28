import type { FormEvent } from 'react';
import type { TagDefinition, TagKey } from '../../lib/contracts/avatar';

interface CatalogControlsProps {
  draftQuery: string;
  selectedTags: readonly TagKey[];
  tagDefinitions: readonly TagDefinition[];
  resultCount: number;
  onDraftQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTag: (tag: TagKey) => void;
  onReset: () => void;
}

export function CatalogControls({
  draftQuery,
  selectedTags,
  tagDefinitions,
  resultCount,
  onDraftQueryChange,
  onSubmit,
  onToggleTag,
  onReset,
}: CatalogControlsProps) {
  const hasFilters = draftQuery.trim() !== '' || selectedTags.length > 0;

  return (
    <section className="catalog-controls" aria-labelledby="catalog-heading">
      <div className="controls-heading">
        <div>
          <p className="eyebrow">Open-source collection</p>
          <h2 id="catalog-heading">Find a face for every agent</h2>
        </div>
        <p className="result-count" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'avatar' : 'avatars'}
        </p>
      </div>

      <form className="search-form" role="search" onSubmit={onSubmit}>
        <label htmlFor="avatar-search">Search avatars</label>
        <div className="search-row">
          <input
            id="avatar-search"
            type="search"
            value={draftQuery}
            placeholder="Try “smile”, “glasses”, or “pixel”"
            autoComplete="off"
            onChange={(event) => onDraftQueryChange(event.currentTarget.value)}
          />
          <button className="button button-primary" type="submit">
            Search
          </button>
        </div>
      </form>

      <div className="tag-section">
        <div className="tag-heading">
          <h3>Filter by trait</h3>
          {hasFilters ? (
            <button className="text-button" type="button" onClick={onReset}>
              Reset filters
            </button>
          ) : null}
        </div>
        <div className="tag-list" aria-label="Avatar traits">
          {tagDefinitions.map((tag) => (
            <button
              className="tag-button"
              type="button"
              aria-pressed={selectedTags.includes(tag.key)}
              key={tag.key}
              onClick={() => onToggleTag(tag.key)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
