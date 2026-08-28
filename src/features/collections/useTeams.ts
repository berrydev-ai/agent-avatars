import { useEffect, useMemo, useState } from 'react';

import type {
  AgentTeam,
  SavedAvatarRef,
  TeamClient,
} from '../../lib/contracts/identity';

export interface TeamCollections {
  teamStatus: 'loading' | 'ready' | 'error';
  teams: readonly AgentTeam[];
  selectedTeamId: string | null;
  nextTeamCursor: string | null;
  busyTeamIds: ReadonlySet<string>;
  teamMessage: string;
  selectTeam(teamId: string): void;
  createTeam(input: { id: string; name: string }): Promise<boolean>;
  renameTeam(input: { teamId: string; name: string }): Promise<boolean>;
  deleteTeam(teamId: string): Promise<boolean>;
  updateTeamMembers(input: {
    teamId: string;
    avatarIds: readonly string[];
  }): Promise<boolean>;
  loadMoreTeams(): Promise<void>;
}

export function useTeams(client: TeamClient): TeamCollections {
  const [teamStatus, setTeamStatus] =
    useState<TeamCollections['teamStatus']>('loading');
  const [teams, setTeams] = useState<readonly AgentTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [nextTeamCursor, setNextTeamCursor] = useState<string | null>(null);
  const [busyTeamIds, setBusyTeamIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [teamMessage, setTeamMessage] = useState('');

  useEffect(() => {
    let active = true;
    void client
      .listTeams()
      .then((page) => {
        if (!active) return;
        setTeams(page.items);
        setSelectedTeamId(page.items[0]?.id ?? null);
        setNextTeamCursor(page.nextCursor);
        setTeamStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setTeamStatus('error');
        setTeamMessage('Agent Teams could not be loaded. Try again shortly.');
      });
    return () => {
      active = false;
    };
  }, [client]);

  return useMemo<TeamCollections>(
    () => ({
      teamStatus,
      teams,
      selectedTeamId,
      nextTeamCursor,
      busyTeamIds,
      teamMessage,
      selectTeam: setSelectedTeamId,
      async createTeam(input) {
        setTeamMessage('');
        setBusyTeamIds(updateSet(input.id, true));
        try {
          const created = await client.createTeam(input);
          setTeams((current) => [
            created,
            ...current.filter(({ id }) => id !== created.id),
          ]);
          setSelectedTeamId(created.id);
          setTeamMessage(`Created ${created.name}.`);
          return true;
        } catch {
          setTeamMessage(
            'Could not create that team. Check the name and try again.',
          );
          return false;
        } finally {
          setBusyTeamIds(updateSet(input.id, false));
        }
      },
      async renameTeam(input) {
        setTeamMessage('');
        setBusyTeamIds(updateSet(input.teamId, true));
        try {
          const renamed = await client.renameTeam(input);
          setTeams(replaceTeam(renamed));
          setTeamMessage(`Renamed the team to ${renamed.name}.`);
          return true;
        } catch {
          setTeamMessage('Could not rename that team. Try a different name.');
          return false;
        } finally {
          setBusyTeamIds(updateSet(input.teamId, false));
        }
      },
      async deleteTeam(teamId) {
        const team = teams.find(({ id }) => id === teamId);
        if (team === undefined) return false;
        setTeamMessage('');
        setBusyTeamIds(updateSet(teamId, true));
        try {
          await client.deleteTeam(teamId);
          setTeams((current) => current.filter(({ id }) => id !== teamId));
          setSelectedTeamId((current) =>
            current === teamId
              ? (teams.find(({ id }) => id !== teamId)?.id ?? null)
              : current,
          );
          setTeamMessage(`Deleted ${team.name}.`);
          return true;
        } catch {
          setTeamMessage(`Could not delete ${team.name}. Try again.`);
          return false;
        } finally {
          setBusyTeamIds(updateSet(teamId, false));
        }
      },
      async updateTeamMembers(input) {
        const previous = teams.find(({ id }) => id === input.teamId);
        if (previous === undefined || busyTeamIds.has(input.teamId))
          return false;
        setTeams(replaceTeam(withMembers(previous, input.avatarIds)));
        setTeamMessage('');
        setBusyTeamIds(updateSet(input.teamId, true));
        try {
          const stored = await client.setMembers(input);
          setTeams(replaceTeam(stored));
          setTeamMessage(`Updated ${stored.name}.`);
          return true;
        } catch {
          setTeams(replaceTeam(previous));
          setTeamMessage(
            `Could not update ${previous.name}. The previous order was restored.`,
          );
          return false;
        } finally {
          setBusyTeamIds(updateSet(input.teamId, false));
        }
      },
      async loadMoreTeams() {
        if (nextTeamCursor === null) return;
        try {
          const page = await client.listTeams({ cursor: nextTeamCursor });
          setTeams((current) => [
            ...current,
            ...page.items.filter(
              ({ id }) => !current.some((team) => team.id === id),
            ),
          ]);
          setNextTeamCursor(page.nextCursor);
        } catch {
          setTeamMessage('More Agent Teams could not be loaded. Try again.');
        }
      },
    }),
    [
      busyTeamIds,
      client,
      nextTeamCursor,
      selectedTeamId,
      teamMessage,
      teamStatus,
      teams,
    ],
  );
}

function replaceTeam(
  replacement: AgentTeam,
): (teams: readonly AgentTeam[]) => readonly AgentTeam[] {
  return (teams) =>
    teams.map((team) => (team.id === replacement.id ? replacement : team));
}

function withMembers(team: AgentTeam, avatarIds: readonly string[]): AgentTeam {
  const availability = new Map<string, SavedAvatarRef['availability']>(
    team.avatars.map((avatar) => [avatar.avatarId, avatar.availability]),
  );
  const avatars: SavedAvatarRef[] = avatarIds.map((avatarId) => ({
    avatarId: avatarId as SavedAvatarRef['avatarId'],
    availability: availability.get(avatarId) ?? 'active',
  }));
  return { ...team, avatars };
}

function updateSet(
  value: string,
  present: boolean,
): (current: ReadonlySet<string>) => ReadonlySet<string> {
  return (current) => {
    const next = new Set(current);
    if (present) next.add(value);
    else next.delete(value);
    return next;
  };
}
