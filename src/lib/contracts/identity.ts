export type AvatarId = string & { readonly __brand: "AvatarId" };

export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNEXPECTED_ERROR";

const errorMessages: Record<AppErrorCode, string> = {
  AUTH_REQUIRED: "Sign in is required.",
  VALIDATION_ERROR: "The supplied value is invalid.",
  NOT_FOUND: "The requested item was not found.",
  CONFLICT: "The requested change conflicts with existing data.",
  RATE_LIMITED: "Too many attempts. Try again later.",
  NETWORK_ERROR: "The service could not be reached.",
  UNEXPECTED_ERROR: "An unexpected error occurred.",
};

export class AppClientError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(code: AppErrorCode, retryable: boolean, cause?: unknown) {
    super(errorMessages[code]);
    this.name = "AppClientError";
    this.code = code;
    this.retryable = retryable;
    if (cause !== undefined) this.cause = cause;
  }
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface EmailPasswordInput {
  email: string;
  password: string;
}

export interface SignUpResult {
  status: "confirmation_required";
  email: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "error"; error: AppClientError };

export interface AuthClient {
  getInitialState(): Promise<AuthState>;
  subscribe(listener: (state: AuthState) => void): () => void;
  signUp(input: EmailPasswordInput): Promise<SignUpResult>;
  confirmEmail(input: {
    tokenHash: string;
    type: "email";
  }): Promise<{ status: "authenticated"; user: AuthUser }>;
  signIn(input: EmailPasswordInput): Promise<{
    status: "authenticated";
    user: AuthUser;
  }>;
  signOut(): Promise<void>;
}

export interface SavedAvatarRef {
  avatarId: AvatarId;
  availability: "active" | "withdrawn";
}

export interface FavoriteClient {
  listFavorites(): Promise<readonly SavedAvatarRef[]>;
  setFavorite(
    avatarId: AvatarId | string,
    isFavorite: boolean,
  ): Promise<boolean>;
}

export interface AgentTeam {
  id: string;
  name: string;
  avatars: readonly SavedAvatarRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: readonly T[];
  nextCursor: string | null;
}

export interface TeamClient {
  listTeams(input?: {
    cursor?: string;
    limit?: number;
  }): Promise<Page<AgentTeam>>;
  createTeam(input: { id: string; name: string }): Promise<AgentTeam>;
  renameTeam(input: { teamId: string; name: string }): Promise<AgentTeam>;
  deleteTeam(teamId: string): Promise<void>;
  setMembers(input: {
    teamId: string;
    avatarIds: readonly (AvatarId | string)[];
  }): Promise<AgentTeam>;
}
