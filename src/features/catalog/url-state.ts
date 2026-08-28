import type { TagKey } from '../../lib/contracts/avatar';

export interface CatalogQueryState {
  query: string;
  tags: readonly TagKey[];
}

export function parseCatalogQuery(
  search: string,
  knownTags: ReadonlySet<TagKey>,
): CatalogQueryState {
  const params = new URLSearchParams(search);
  const query = (params.get('q') ?? '').trim();
  const tags = [...new Set((params.get('tags') ?? '').split(','))]
    .filter((tag): tag is TagKey => knownTags.has(tag))
    .sort();
  return { query, tags };
}

export function serializeCatalogQuery(state: CatalogQueryState): string {
  const params = new URLSearchParams();
  const query = state.query.trim();
  const tags = [...new Set(state.tags)].sort();
  if (query) params.set('q', query);
  if (tags.length > 0) params.set('tags', tags.join(','));
  const value = params.toString();
  return value ? `?${value}` : '';
}
