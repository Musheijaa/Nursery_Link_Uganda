import type { components } from './schema.js';

export type AuthTokens = components['schemas']['AuthTokens'];
export type PublicUser = components['schemas']['PublicUser'];

export interface SessionState {
  user: PublicUser | null;
  /** True until the first silent refresh (on app start) has finished */
  restoring: boolean;
}

/**
 * The signed-in session, held in memory only. The long-lived refresh token is an httpOnly cookie
 * the browser sends to /auth/refresh; scripts can never read it.
 */
export class Session {
  private accessToken: string | null = null;
  private state: SessionState = { user: null, restoring: true };
  private readonly listeners = new Set<(s: SessionState) => void>();
  private refreshing: Promise<string | null> | null = null;

  constructor(private readonly doRefresh: () => Promise<AuthTokens | null>) {}

  get token(): string | null {
    return this.accessToken;
  }

  get snapshot(): SessionState {
    return this.state;
  }

  subscribe(listener: (s: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  signIn(tokens: AuthTokens): void {
    this.accessToken = tokens.access_token;
    this.set({ user: tokens.user, restoring: false });
  }

  signOut(): void {
    this.accessToken = null;
    this.set({ user: null, restoring: false });
  }

  /**
   * Gets a new access token from the refresh cookie. Concurrent callers share one request, so a
   * burst of 401s triggers a single refresh (the API revokes reused refresh tokens).
   */
  refresh(): Promise<string | null> {
    this.refreshing ??= this.doRefresh()
      .then(tokens => {
        if (tokens) this.signIn(tokens);
        else this.signOut();
        return tokens?.access_token ?? null;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private set(state: SessionState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
