import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import type { AuthGateway, GatewayResult } from "./auth-client";
import type { IdentityDataGateway } from "./data-client";

export function createSupabaseAuthGateway(
  client: SupabaseClient<Database>,
): AuthGateway {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      return { data: { session: data.session }, error };
    },

    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(session?.user ?? null);
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },

    async signUp(input) {
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { emailRedirectTo: input.emailRedirectTo },
      });
      return { data: data.user === null ? null : { user: data.user }, error };
    },

    async verifyEmail(tokenHash) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });
      return { data: data.user === null ? null : { user: data.user }, error };
    },

    async signIn(input) {
      const { data, error } = await client.auth.signInWithPassword(input);
      return { data: data.user === null ? null : { user: data.user }, error };
    },

    async signOut() {
      return client.auth.signOut({ scope: "local" });
    },
  };
}

export function createSupabaseDataGateway(
  client: SupabaseClient<Database>,
): IdentityDataGateway {
  return {
    async listFavorites() {
      return client
        .from("favorites")
        .select("avatar_id, avatars!inner(publication_status)")
        .order("created_at", { ascending: false })
        .order("avatar_id", { ascending: true });
    },

    async setFavorite(input) {
      return client.rpc("set_favorite", {
        p_avatar_id: input.avatarId,
        p_is_favorite: input.isFavorite,
      });
    },

    async listTeams(input) {
      let query = client
        .from("agent_teams")
        .select("id, name, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(input.limit);
      if (input.after !== null) {
        query = query.or(
          `updated_at.lt.${input.after.updatedAt},and(updated_at.eq.${input.after.updatedAt},id.gt.${input.after.id})`,
        );
      }
      return query;
    },

    async listMembers(teamIds) {
      return client
        .from("agent_team_avatars")
        .select(
          "team_id, avatar_id, position, avatars!inner(publication_status)",
        )
        .in("team_id", [...teamIds])
        .order("position", { ascending: true });
    },

    async createTeam(input) {
      return client.rpc("create_agent_team", {
        p_id: input.id,
        p_name: input.name,
      });
    },

    async renameTeam(input) {
      return client.rpc("rename_agent_team", {
        p_team_id: input.teamId,
        p_name: input.name,
      });
    },

    async deleteTeam(teamId) {
      return client.rpc("delete_agent_team", { p_team_id: teamId });
    },

    async setMembers(input) {
      return client.rpc("set_agent_team_members", {
        p_team_id: input.teamId,
        p_avatar_ids: [...input.avatarIds],
      });
    },

    async getTeam(teamId) {
      return client
        .from("agent_teams")
        .select("id, name, created_at, updated_at")
        .eq("id", teamId)
        .single();
    },
  };
}

export type SupabaseGatewayResult<T> = GatewayResult<T>;
