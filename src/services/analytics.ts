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
 *  - The logged-in account is a *mentor*. A mentor manages one or more
 *    *students* (add/edit on the home page) and switches the active student
 *    during play. Whichever student is active is attached automatically to
 *    every session and step (`student_id`), so the admin dashboard can break
 *    analytics down per student. The active student is persisted so it
 *    survives reloads.
 *
 * Configure the server URL with the Vite env var `VITE_ANALYTICS_API`
 * (e.g. VITE_ANALYTICS_API=http://localhost:8000). Defaults to same-origin "".
 */

const API_BASE: string =
  (import.meta as any).env?.VITE_ANALYTICS_API ?? "";
const TOKEN_KEY = "ag_player_token";
const STUDENT_KEY = "ag_active_student";

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

export interface AuthResponse {
  access_token: string;
  token_type: string;
  created: boolean;
  user: PlayerUser;
}

export interface Student {
  id: string;
  mentor_id: string;
  full_name: string;
  date_of_birth: string | null;
  notes: string | null;
  avatar: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StudentInput {
  full_name: string;
  date_of_birth?: string | null;
  notes?: string | null;
  avatar?: string | null;
}

/** A learner's saved progress on one level of a level-based game. */
export interface LevelProgress {
  id: string;
  student_id: string | null;
  game_key: string;
  level: string;
  attempts: number;
  best_score: number;
  best_accuracy: number;
  unlocked: boolean;
  passed: boolean;
  mastered: boolean;
  updated_at: string;
}

export interface ProgressSubmit {
  game_key: string;
  level: string;
  score: number;
  total: number;
}

class AnalyticsClient {
  private token: string | null =
    typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  private studentId: string | null =
    typeof localStorage !== "undefined" ? localStorage.getItem(STUDENT_KEY) : null;

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
    this.setActiveStudent(null);
  }

  // --- Students -------------------------------------------------------------

  /** The id of the student currently being played for, if any. */
  get activeStudentId(): string | null {
    return this.studentId;
  }

  /** Switch the active student (call from the switch-student control). */
  setActiveStudent(studentId: string | null) {
    this.studentId = studentId;
    if (studentId) localStorage.setItem(STUDENT_KEY, studentId);
    else localStorage.removeItem(STUDENT_KEY);
  }

  /** List the mentor's students (for the home page + switch-student picker). */
  async listStudents(includeInactive = false): Promise<Student[]> {
    if (!this.token) return [];
    return this.request<Student[]>(
      `/api/students?include_inactive=${includeInactive}`,
    );
  }

  /** Add a student under the logged-in mentor. */
  async createStudent(input: StudentInput): Promise<Student> {
    return this.request<Student>("/api/students", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  /** Edit a student (partial fields, plus optional activate/deactivate). */
  async updateStudent(
    studentId: string,
    input: Partial<StudentInput> & { is_active?: boolean },
  ): Promise<Student> {
    return this.request<Student>(`/api/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  /** Delete a student. Their past records are kept but detached. */
  async deleteStudent(studentId: string): Promise<void> {
    await this.request(`/api/students/${studentId}`, { method: "DELETE" });
    if (this.studentId === studentId) this.setActiveStudent(null);
  }

  // --- Level progress -------------------------------------------------------

  /**
   * Load the active student's saved level progress for a game. Returns [] when
   * logged out (progression then lives only in memory for the session).
   */
  async getProgress(gameKey: string): Promise<LevelProgress[]> {
    if (!this.token) return [];
    const q = new URLSearchParams({ game_key: gameKey });
    if (this.studentId) q.set("student_id", this.studentId);
    try {
      return await this.request<LevelProgress[]>(`/api/progress?${q.toString()}`);
    } catch {
      return [];
    }
  }

  /**
   * Report a finished level attempt. The server updates best score/accuracy,
   * attempt count and unlock state, and returns the refreshed rows. Returns []
   * when logged out.
   */
  async submitProgress(input: ProgressSubmit): Promise<LevelProgress[]> {
    if (!this.token) return [];
    try {
      return await this.request<LevelProgress[]>("/api/progress", {
        method: "POST",
        body: JSON.stringify({ ...input, student_id: this.studentId }),
      });
    } catch (err) {
      console.warn("[analytics] failed to save progress:", err);
      return [];
    }
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

  /**
   * Start a play session. Returns the session id, or null if not logged in.
   * The active student (if any) is attached automatically.
   */
  async startSession(gameKey: string): Promise<string | null> {
    if (!this.token) return null;
    const s = await this.request<{ id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ game_key: gameKey, student_id: this.studentId }),
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
          student_id: this.studentId,
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
