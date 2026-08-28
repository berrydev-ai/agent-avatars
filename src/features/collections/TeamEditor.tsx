import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { AvatarRecord } from '../../lib/contracts/avatar';
import type { AgentTeam } from '../../lib/contracts/identity';

interface TeamEditorProps {
  team: AgentTeam;
  avatarLookup: ReadonlyMap<string, AvatarRecord>;
  busy: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onSetMembers: (avatarIds: readonly string[]) => Promise<boolean>;
}

export function TeamEditor({
  team,
  avatarLookup,
  busy,
  onRename,
  onDelete,
  onSetMembers,
}: TeamEditorProps) {
  const [name, setName] = useState(team.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const deletePromptId = `delete-${team.id}-prompt`;

  useEffect(() => {
    if (confirmingDelete) confirmRef.current?.focus();
  }, [confirmingDelete]);

  function cancelDelete(): void {
    setConfirmingDelete(false);
    window.setTimeout(() => deleteRef.current?.focus(), 0);
  }

  function submitRename(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void onRename(name);
  }

  return (
    <section className="team-editor" aria-labelledby={`team-${team.id}`}>
      <div className="team-editor-heading">
        <div>
          <p className="eyebrow">Selected team</p>
          <h3 id={`team-${team.id}`}>{team.name}</h3>
        </div>
        <span>{team.avatars.length}/100 avatars</span>
      </div>

      <form className="team-rename-form" onSubmit={submitRename}>
        <label htmlFor={`rename-${team.id}`}>Team name</label>
        <div>
          <input
            id={`rename-${team.id}`}
            aria-label={`Rename ${team.name}`}
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <button
            className="button button-secondary"
            type="submit"
            disabled={busy || name.trim() === team.name}
          >
            Save team name
          </button>
        </div>
      </form>

      {team.avatars.length === 0 ? (
        <p className="team-empty">
          No avatars in {team.name} yet. Add one from the catalog below.
        </p>
      ) : (
        <ul className="team-members" aria-label={`Members of ${team.name}`}>
          {team.avatars.map((member, index) => {
            const avatar = avatarLookup.get(member.avatarId);
            const label =
              member.availability === 'withdrawn' || avatar === undefined
                ? 'Avatar unavailable'
                : readablePreset(avatar.preset);
            return (
              <li key={member.avatarId}>
                <span>{label}</span>
                <div className="team-member-actions">
                  <button
                    type="button"
                    aria-label={`Move ${label} up`}
                    disabled={busy || index === 0}
                    onClick={() =>
                      void onSetMembers(moveMember(team, index, index - 1))
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${label} down`}
                    disabled={busy || index === team.avatars.length - 1}
                    onClick={() =>
                      void onSetMembers(moveMember(team, index, index + 1))
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${label} from ${team.name}`}
                    disabled={busy}
                    onClick={() =>
                      void onSetMembers(
                        team.avatars
                          .filter(
                            ({ avatarId }) => avatarId !== member.avatarId,
                          )
                          .map(({ avatarId }) => avatarId),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="team-delete-area">
        {confirmingDelete ? (
          <div
            className="delete-confirmation"
            role="alertdialog"
            aria-labelledby={deletePromptId}
          >
            <p id={deletePromptId}>
              Delete {team.name} and all of its membership?
            </p>
            <button
              ref={confirmRef}
              className="button button-danger"
              type="button"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              Confirm delete {team.name}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={cancelDelete}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            ref={deleteRef}
            className="text-button text-button-danger"
            type="button"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete {team.name}
          </button>
        )}
      </div>
    </section>
  );
}

function moveMember(
  team: AgentTeam,
  from: number,
  to: number,
): readonly string[] {
  const ids = team.avatars.map(({ avatarId }) => avatarId);
  const [moved] = ids.splice(from, 1);
  if (moved !== undefined) ids.splice(to, 0, moved);
  return ids;
}

function readablePreset(preset: string): string {
  return preset
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
