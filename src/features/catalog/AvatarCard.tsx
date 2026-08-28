import type { AvatarRecord, TagDefinition } from '../../lib/contracts/avatar';

interface AvatarCardProps {
  avatar: AvatarRecord;
  tagDefinitions: ReadonlyMap<string, TagDefinition>;
  busyAction: string | undefined;
  isFavorite?: boolean | undefined;
  favoriteBusy?: boolean | undefined;
  onToggleFavorite?:
    ((avatar: AvatarRecord, label: string) => void) | undefined;
  onDownload: (avatar: AvatarRecord) => void;
  onOpen: (avatar: AvatarRecord) => void;
  onCopy: (avatar: AvatarRecord) => void;
}

export function AvatarCard({
  avatar,
  tagDefinitions,
  busyAction,
  isFavorite,
  favoriteBusy,
  onToggleFavorite,
  onDownload,
  onOpen,
  onCopy,
}: AvatarCardProps) {
  const labels = avatar.tags
    .map((tag) => tagDefinitions.get(tag)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
  const name = readablePreset(avatar.preset);

  return (
    <li className="avatar-card">
      <div className="avatar-frame">
        <img
          src={avatar.assetPath}
          alt={avatar.alt}
          width={avatar.width}
          height={avatar.height}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="card-body">
        {onToggleFavorite ? (
          <button
            className="favorite-button"
            type="button"
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? `Remove ${name} from favorites`
                : `Save ${name} to favorites`
            }
            disabled={favoriteBusy}
            onClick={() => onToggleFavorite(avatar, name)}
          >
            <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span>
            {isFavorite ? 'Saved' : 'Save'}
          </button>
        ) : null}
        <p className="avatar-name">{name}</p>
        <ul className="card-tags" aria-label="Visible traits">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <div className="card-actions" aria-label={`Actions for ${avatar.alt}`}>
          <button
            className="button button-primary"
            type="button"
            disabled={busyAction === 'download'}
            onClick={() => onDownload(avatar)}
          >
            {busyAction === 'download' ? 'Checking…' : 'Download'}
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => onOpen(avatar)}
          >
            Open
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => onCopy(avatar)}
          >
            Copy link
          </button>
        </div>
      </div>
    </li>
  );
}

function readablePreset(preset: string): string {
  return preset
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
