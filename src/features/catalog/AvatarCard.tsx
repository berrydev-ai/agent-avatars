import type { AvatarRecord, TagDefinition } from '../../lib/contracts/avatar';

interface AvatarCardProps {
  avatar: AvatarRecord;
  tagDefinitions: ReadonlyMap<string, TagDefinition>;
  busyAction: string | undefined;
  onDownload: (avatar: AvatarRecord) => void;
  onOpen: (avatar: AvatarRecord) => void;
  onCopy: (avatar: AvatarRecord) => void;
}

export function AvatarCard({
  avatar,
  tagDefinitions,
  busyAction,
  onDownload,
  onOpen,
  onCopy,
}: AvatarCardProps) {
  const labels = avatar.tags
    .map((tag) => tagDefinitions.get(tag)?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

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
        <p className="avatar-name">{readablePreset(avatar.preset)}</p>
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
