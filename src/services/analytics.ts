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
  designation?: string;
  organisation?: string;
  mobile_number?: string;
  avatar?: string;
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

/** Editable mentor-profile fields (Complete Your Profile / Profile screens). */
export interface ProfileInput {
  full_name?: string | null;
  designation?: string | null;
  organisation?: string | null;
  mobile_number?: string | null;
  avatar?: string | null;
}

export interface PlayerUser {
  id: string;
  email: string;
  full_name: string | null;
  designation: string | null;
  organisation: string | null;
  mobile_number: string | null;
  avatar: string | null;
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
  gender: string | null;
  parent_guardian_name: string | null;
  parent_contact: string | null;
  autism_level: string | null;
  iq_score: number | null;
  rehabilitation_centre: string | null;
  participant_code: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StudentInput {
  full_name: string;
  date_of_birth?: string | null;
  notes?: string | null;
  avatar?: string | null;
  gender?: string | null;
  parent_guardian_name?: string | null;
  parent_contact?: string | null;
  autism_level?: string | null;
  iq_score?: number | null;
  rehabilitation_centre?: string | null;
}

/** Composite progress report for one student (Progress dashboard). */
export interface StudentReport {
  student_id: string;
  summary: {
    completion_pct: number;
    games_done: number;
    total_games: number;
    sessions: number;
  };
  timeseries: { label: string; value: number }[];
  by_game: { game_key: string; activities: number }[];
  recent: { game_key: string; label: string; when: string; score: number | null }[];
}

/** Per-emotion first-attempt performance (Emotion Recognition + Emotion Clips). */
export interface EmotionStat {
  emotion: string;
  total: number;
  correct: number;
  accuracy: number; // 0..1
  median_latency_ms: number | null;
}

/** Per-student emotion identification profile: `confusion[shown][picked]`
 *  counts first attempts — the diagonal is correct, off-diagonal cells show
 *  which emotion the child confused the shown one with. */
export interface EmotionReport {
  student_id: string;
  emotions: string[];
  confusion: Record<string, Record<string, number>>;
  stats: EmotionStat[];
}

/** Standardised 0–100 score for one game (chance-corrected first-attempt
 *  accuracy) plus secondary metrics and pre/post improvement. See the server's
 *  `app/scoring.py` for the exact definition. */
export interface GameScore {
  game_key: string;
  skill: string;
  score: number | null; // 0–100, chance-corrected
  raw_accuracy: number | null; // 0–1, uncorrected
  n_trials: number;
  n_sessions: number;
  median_latency_ms: number | null;
  baseline_score: number | null; // first session (pre)
  latest_score: number | null; // most recent session (post)
  delta: number | null; // latest − baseline (improvement)
}

/** Mean 0–100 score across the games that train one target skill. */
export interface SkillScore {
  skill: string;
  label: string;
  score: number | null;
  delta: number | null;
  n_games: number;
  games: GameScore[];
}

/** Per-participant standardised profile: composite social-emotional score, the
 *  four skill scores, per-game scores, and improvement at every level. */
export interface ParticipantSkillReport {
  student_id: string;
  composite: number | null;
  composite_delta: number | null;
  n_sessions: number;
  n_trials: number;
  skills: SkillScore[];
}

/** Mean / SD / mean-improvement of one metric across a cohort. */
export interface GroupStat {
  metric: string; // "composite" or a skill id
  label: string;
  mean: number | null;
  sd: number | null;
  mean_delta: number | null;
  n: number;
}

export interface GroupBreakdown {
  group: string; // demographic bucket, or "all"
  n_participants: number;
  stats: GroupStat[];
}

/** Cohort-level scores, optionally split by a demographic dimension. */
export interface GroupReport {
  group_by: string; // overall | gender | autism_level | age_band | iq_band
  total_participants: number;
  breakdowns: GroupBreakdown[];
}

/** How a group report may be sliced. */
export type GroupBy = "overall" | "gender" | "autism_level" | "age_band" | "iq_band";

/** 0–100 chance-corrected accuracy for one construct (e.g. "sharing"), pooled
 *  across a student's recent sessions of that game — a single session only
 *  carries ~2 trials per construct, too few to read alone. */
export interface ConstructScore {
  construct: string;
  score: number | null;
  raw_accuracy: number | null;
  n_trials: number;
  median_latency_ms: number | null;
}

/** Per-construct profile for one social-norms game (Right or Wrong or Good
 *  Choice), pooled across the student's most recent sessions. */
export interface GameConstructReport {
  game_key: string;
  constructs: ConstructScore[];
  n_sessions_pooled: number;
  session_window: number;
}

/** Per-construct profiles for both social-norms games. */
export interface SocialNormsReport {
  student_id: string;
  games: GameConstructReport[];
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

  /** Update the mentor's own profile (Complete Your Profile / Profile). */
  async updateMe(input: ProfileInput): Promise<PlayerUser> {
    return this.request<PlayerUser>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  /** Load the composite progress report for a student (Progress dashboard). */
  async getStudentReport(studentId: string): Promise<StudentReport> {
    return this.request<StudentReport>(`/api/reports/student/${studentId}`);
  }

  /** Load the per-emotion confusion/latency profile (Progress dashboard). */
  async getEmotionReport(studentId: string): Promise<EmotionReport> {
    return this.request<EmotionReport>(
      `/api/reports/student/${studentId}/emotions`,
    );
  }

  /** Standardised per-participant skill profile: composite social-emotional
   *  score, the four skill scores, per-game scores and pre/post improvement. */
  async getSkillReport(studentId: string): Promise<ParticipantSkillReport> {
    return this.request<ParticipantSkillReport>(
      `/api/reports/student/${studentId}/skills`,
    );
  }

  /** Per-construct profile for the social-norms games (Right or Wrong, Good
   *  Choice), pooled across the student's most recent `sessions` of each
   *  game so a single short session's ~2 trials per construct aren't read
   *  alone (Progress dashboard). */
  async getSocialNormsReport(studentId: string, sessions?: number): Promise<SocialNormsReport> {
    const q = sessions != null ? `?sessions=${sessions}` : "";
    return this.request<SocialNormsReport>(
      `/api/reports/student/${studentId}/social-norms${q}`,
    );
  }

  /** Cohort scores across the mentor's students, optionally split by a
   *  demographic dimension (gender / autism level / age band / IQ band). */
  async getGroupReport(
    groupBy: GroupBy = "overall",
    filters: { gender?: string; autism_level?: string } = {},
  ): Promise<GroupReport> {
    const q = new URLSearchParams({ group_by: groupBy });
    if (filters.gender) q.set("gender", filters.gender);
    if (filters.autism_level) q.set("autism_level", filters.autism_level);
    return this.request<GroupReport>(`/api/reports/groups?${q.toString()}`);
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
