/**
 * Analytics client for the Autism Games app.
 *
 * Copy this into `src/services/analytics.ts`.
 *
 * Behaviour (matches the product requirements):
 *  - Sign-up and login are optional. The JWT is persisted in localStorage.
 *  - Sign-up *is* login: a successful sign-up stores the token and signs the player in.
 *    Calling `signup` again with the same email + password just logs back in.
 *  - Steps are recorded ONLY when a player is logged in. If not logged in,
 *    `recordStep` / `startSession` etc. resolve to no-ops, so you can call them
 *    unconditionally from game code.
 *
 * Configure the server URL with the Vite env var `VITE_ANALYTICS_API`
 * (e.g. VITE_ANALYTICS_API=http://localhost:8000). Defaults to same-origin "".
 */

const API_BASE: string =
  (import.meta as any).env?.VITE_ANALYTICS_API ?? "";
const TOKEN_KEY = "ag_player_token";

export interface SignupInput {
  email: string;
  password: string;
  full_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  education_level?: string;
  institution?: string;
  field_of_study?: string;
}

export interface PlayerUser {
  id: string;
  email: string;
  full_name: string | null;
  city: string | null;
  education_level: string | null;
  [key: string]: unknown;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  created: boolean;
  user: PlayerUser;
}

class AnalyticsClient {
  private token: string | null =
    typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  private setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  logout() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(API_BASE + path, { ...init, headers });
    if (res.status === 401) {
      this.logout();
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        detail = (await res.json()).detail ?? detail;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }
    return (res.status === 204 ? null : await res.json()) as T;
  }

  /** Sign up (also logs in). Idempotent for the same email + password. */
  async signup(input: SignupInput): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
    this.setToken(data.access_token);
    return data;
  }

  /** Explicit email + password login. */
  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async me(): Promise<PlayerUser | null> {
    if (!this.token) return null;
    try {
      return await this.request<PlayerUser>("/api/auth/me");
    } catch {
      return null;
    }
  }

  /** Start a play session. Returns the session id, or null if not logged in. */
  async startSession(gameKey: string): Promise<string | null> {
    if (!this.token) return null;
    const s = await this.request<{ id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ game_key: gameKey }),
    });
    return s.id;
  }

  async endSession(sessionId: string, finalScore?: number): Promise<void> {
    if (!this.token) return;
    await this.request(`/api/sessions/${sessionId}/end`, {
      method: "POST",
      body: JSON.stringify({ final_score: finalScore ?? null }),
    });
  }

  /**
   * Record a single game step. No-op (resolves silently) if the player is not
   * logged in, so this is safe to call from anywhere in game code.
   */
  async recordStep(
    gameKey: string,
    eventType: string,
    payload?: Record<string, unknown>,
    opts: { stepIndex?: number; score?: number; sessionId?: string } = {},
  ): Promise<void> {
    if (!this.token) return;
    try {
      await this.request("/api/events", {
        method: "POST",
        body: JSON.stringify({
          game_key: gameKey,
          event_type: eventType,
          step_index: opts.stepIndex,
          score: opts.score,
          session_id: opts.sessionId,
          payload: payload ?? null,
          client_timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // Never let analytics break gameplay.
      console.warn("[analytics] failed to record step:", err);
    }
  }
}

export const analytics = new AnalyticsClient();
