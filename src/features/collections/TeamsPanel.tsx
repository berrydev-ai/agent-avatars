import { useMemo, useRef, useState, type FormEvent } from 'react';

import type { AvatarRecord } from '../../lib/contracts/avatar';
import { useOptionalCollections } from './collections-context';
import { TeamEditor } from './TeamEditor';

export function TeamsPanel({ avatars }: { avatars: readonly AvatarRecord[] }) {
  const collections = useOptionalCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const createIntent = useRef<{ name: string; id: string } | null>(null);
  const avatarLookup = useMemo(
    () => new Map(avatars.map((avatar) => [avatar.id, avatar])),
    [avatars],
  );

  if (!collections?.authenticated) return null;
  const activeCollections = collections;

  const selectedTeam = collections.teams.find(
    ({ id }) => id === collections.selectedTeamId,
  );

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedName = newName.trim();
    const intent =
      createIntent.current?.name === normalizedName
        ? createIntent.current
        : { name: normalizedName, id: crypto.randomUUID() };
    createIntent.current = intent;
    if (await activeCollections.createTeam(intent)) {
      setNewName('');
      createIntent.current = null;
    }
  }

  return (
    <section className="teams-panel" aria-labelledby="teams-panel-title">
      <button
        id="teams-panel-title"
        className="button button-secondary teams-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Agent Teams ({collections.teams.length})
      </button>

      {open ? (
        <div className="teams-workspace">
          <div className="teams-sidebar">
            <form
              className="create-team-form"
              onSubmit={(event) => void create(event)}
            >
              <label htmlFor="new-team-name">New team name</label>
              <div>
                <input
                  id="new-team-name"
                  value={newName}
                  maxLength={80}
                  required
                  onChange={(event) => {
                    setNewName(event.currentTarget.value);
                    createIntent.current = null;
                  }}
                />
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={newName.trim() === ''}
                >
                  Create team
                </button>
              </div>
            </form>

            {collections.teamStatus === 'loading' ? (
              <p role="status">Loading Agent Teams…</p>
            ) : collections.teamStatus === 'error' ? (
              <p className="team-load-error" role="alert">
                Agent Teams could not be loaded. Reload the page to try again.
              </p>
            ) : collections.teams.length === 0 ? (
              <p className="team-empty">No Agent Teams yet.</p>
            ) : (
              <nav className="team-list" aria-label="Agent Teams">
                {collections.teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    aria-current={team.id === collections.selectedTeamId}
                    onClick={() => collections.selectTeam(team.id)}
                  >
                    <span>{team.name}</span>
                    <small>{team.avatars.length} avatars</small>
                  </button>
                ))}
              </nav>
            )}

            {collections.nextTeamCursor ? (
              <button
                className="text-button"
                type="button"
                onClick={() => void collections.loadMoreTeams()}
              >
                Load more teams
              </button>
            ) : null}
          </div>

          {selectedTeam ? (
            <TeamEditor
              key={`${selectedTeam.id}:${selectedTeam.name}`}
              team={selectedTeam}
              avatarLookup={avatarLookup}
              busy={collections.busyTeamIds.has(selectedTeam.id)}
              onRename={(name) =>
                collections.renameTeam({ teamId: selectedTeam.id, name })
              }
              onDelete={() => collections.deleteTeam(selectedTeam.id)}
              onSetMembers={(avatarIds) =>
                collections.updateTeamMembers({
                  teamId: selectedTeam.id,
                  avatarIds,
                })
              }
            />
          ) : (
            <div className="team-editor team-editor-placeholder">
              <p>Create a team to start arranging agent avatars.</p>
            </div>
          )}
        </div>
      ) : null}

      {collections.teamMessage ? (
        <p
          className="collection-feedback"
          role="alert"
          aria-label="Team update"
        >
          {collections.teamMessage}
        </p>
      ) : null}
    </section>
  );
}
