"""Unit tests for the standardised scoring engine (app/scoring.py).

Pure — no database or app settings required, so these always run.
"""
from datetime import date, datetime, timedelta
from types import SimpleNamespace

from app import scoring

T0 = datetime(2026, 1, 1, 12, 0, 0)


def ev(game, etype, payload, session="s1", offset=0):
    return SimpleNamespace(
        game_key=game,
        event_type=etype,
        payload=payload,
        session_id=session,
        created_at=T0 + timedelta(minutes=offset),
    )


def answers(game, n_correct, n_total, level="easy", **extra):
    out = []
    for i in range(n_total):
        p = {"correct": i < n_correct, "level": level, **extra}
        out.append(ev(game, "answer", p, offset=i))
    return out


# --- correction for guessing --------------------------------------------------


def test_emotionrec_corrected_score():
    # 8/10 correct at Easy (chance 0.5): (0.8-0.5)/(1-0.5) = 0.6 -> 60.0
    g = scoring.score_game("emotionrecognition", answers("emotionrecognition", 8, 10, "easy"))
    assert g.raw_accuracy == 0.8
    assert g.score == 60.0
    assert g.n_trials == 10


def test_chance_level_performance_scores_zero():
    # 5/10 at chance 0.5 is exactly chance -> 0, and below-chance clamps to 0.
    g = scoring.score_game("emotionrecognition", answers("emotionrecognition", 5, 10, "easy"))
    assert g.score == 0.0
    below = scoring.score_game("emotionrecognition", answers("emotionrecognition", 2, 10, "easy"))
    assert below.score == 0.0


def test_perfect_scores_100():
    g = scoring.score_game("rightway", [ev("rightway", "answer", {"correct": True, "chance": 0.5}) for _ in range(6)])
    assert g.score == 100.0


def test_rightway_reads_payload_chance():
    evs = [ev("rightway", "answer", {"correct": i < 3, "chance": 0.5}) for i in range(4)]
    g = scoring.score_game("rightway", evs)
    # 3/4 = 0.75, chance 0.5 -> (0.25)/(0.5) = 0.5 -> 50.0
    assert g.score == 50.0


# --- first-attempt handling ---------------------------------------------------


def test_clips_first_attempt_only():
    evs = [
        ev("identifyemotions", "answer", {"correct": False, "attempt": 1, "level": "easy"}),
        ev("identifyemotions", "answer", {"correct": True, "attempt": 2, "level": "easy"}),  # retry ignored
        ev("identifyemotions", "answer", {"correct": True, "attempt": 1, "level": "easy"}),
    ]
    g = scoring.score_game("identifyemotions", evs)
    assert g.n_trials == 2  # the attempt==2 retry is excluded
    assert g.raw_accuracy == 0.5


def test_museum_first_attempt_among_completed_rounds():
    evs = [
        ev("museum", "answer", {"correct": False, "cue": "pulse"}),  # a wrong tap (not round-closing)
        ev("museum", "answer", {"correct": True, "firstAttempt": False, "cue": "pulse"}),  # round closed, not first-try
        ev("museum", "answer", {"correct": True, "firstAttempt": True, "cue": "pulse"}),  # first-try success
    ]
    g = scoring.score_game("museum", evs)
    assert g.n_trials == 2  # two completed rounds
    assert g.raw_accuracy == 0.5
    # pulse -> 3 targets -> chance 1/3; (0.5-0.333)/(0.667) = 0.25 -> 25.0
    assert g.score == 25.0


def test_museum_chance_prefers_visible_count_over_cue():
    # New events carry visibleCount (cue fades within a session, so it no
    # longer identifies the pedestal count); legacy events fall back to cue.
    evs = [
        ev("museum", "answer", {"correct": True, "firstAttempt": False, "cue": "gaze", "visibleCount": 6}),
        ev("museum", "answer", {"correct": True, "firstAttempt": True, "cue": "gaze", "visibleCount": 6}),
    ]
    g = scoring.score_game("museum", evs)
    # p=0.5, chance 1/6 -> (0.5-0.1667)/(0.8333) = 0.4 -> 40.0
    assert g.score == 40.0
    legacy = scoring.score_game("museum", [ev("museum", "answer", {"correct": True, "firstAttempt": True, "cue": "hover"})])
    assert legacy.n_trials == 1 and legacy.score == 100.0  # cue-map fallback still works


def test_rollback_partner_chance_from_cue():
    evs = [ev("rollback", "roll_return", {"correct": True, "firstAttempt": True, "cue": "gesture"}) for _ in range(4)]
    g = scoring.score_game("rollback", evs)
    # all first-try correct -> p=1 -> 100 regardless of chance
    assert g.score == 100.0
    assert g.n_trials == 4


def test_blocks_placements_vs_impatient():
    evs = [ev("blocks", "place_block", {}) for _ in range(3)] + [ev("blocks", "impatient_tap", {})]
    g = scoring.score_game("blocks", evs)
    assert g.n_trials == 4
    assert g.raw_accuracy == 0.75
    assert g.score == 75.0  # chance 0 -> score == raw accuracy * 100


def test_discovery_spontaneous_shares():
    evs = [
        ev("discovery", "event_ready", {"discovery": "gem", "saliency": "big"}),  # not a trial
        ev("discovery", "nudge", {"kind": "share", "count": 1}),  # not a trial
        ev("discovery", "share", {"correct": True, "spontaneous": True, "nudges": 0, "latencyMs": 2100}),
        ev("discovery", "share", {"correct": False, "spontaneous": False, "nudges": 2, "latencyMs": 9400}),
    ]
    g = scoring.score_game("discovery", evs)
    assert g.skill == "jointattention"
    assert g.n_trials == 2  # only completed shares count
    assert g.raw_accuracy == 0.5
    assert g.score == 50.0  # chance 0 -> score == raw accuracy * 100
    assert g.median_latency_ms == 5750


# --- improvement (pre/post) ---------------------------------------------------


def test_improvement_first_vs_latest_session():
    early = [ev("emotionrecognition", "answer", {"correct": i < 5, "level": "easy"}, session="s1", offset=i) for i in range(10)]
    late = [ev("emotionrecognition", "answer", {"correct": True, "level": "easy"}, session="s2", offset=100 + i) for i in range(10)]
    g = scoring.score_game("emotionrecognition", early + late)
    assert g.baseline_score == 0.0  # 5/10 at chance
    assert g.latest_score == 100.0  # 10/10
    assert g.delta == 100.0


# --- aggregation to skills + composite ---------------------------------------


def test_participant_aggregation():
    evs = (
        answers("emotionrecognition", 8, 10, "easy")  # emotion game -> 60
        + [ev("rightway", "answer", {"correct": True, "chance": 0.5}) for _ in range(4)]  # socialnorms -> 100
    )
    ps = scoring.score_participant(evs)
    emo = next(s for s in ps.skills if s.skill == "emotion")
    soc = next(s for s in ps.skills if s.skill == "socialnorms")
    ta = next(s for s in ps.skills if s.skill == "turntaking")
    assert emo.score == 60.0
    assert soc.score == 100.0
    assert ta.score is None  # no turn-taking data
    # composite = mean of skills that have data (60, 100) = 80
    assert ps.composite == 80.0


# --- cohort aggregation + demographic bands ----------------------------------


def test_group_aggregate_mean_sd():
    p1 = scoring.score_participant(answers("emotionrecognition", 10, 10, "easy"))  # emotion 100 -> composite 100
    p2 = scoring.score_participant(answers("emotionrecognition", 8, 10, "easy"))  # emotion 60 -> composite 60
    stats = scoring.aggregate_group([p1, p2])
    comp = next(s for s in stats if s.metric == "composite")
    assert comp.mean == 80.0
    assert comp.n == 2
    assert comp.sd is not None and comp.sd > 0


# --- per-construct scores (social-norms games) --------------------------------


def construct_answers(game, construct, n_correct, n_total, session, chance=0.5, offset=0):
    out = []
    for i in range(n_total):
        p = {"correct": i < n_correct, "construct": construct, "chance": chance}
        out.append(ev(game, "answer", p, session=session, offset=offset + i))
    return out


def test_score_constructs_pools_trials_across_sessions():
    # Two sessions of "greetings": 1/2 correct each -> pooled 2/4 at chance 0.5.
    evs = (
        construct_answers("rightway", "greetings", 1, 2, session="s1", offset=0)
        + construct_answers("rightway", "greetings", 1, 2, session="s2", offset=10)
    )
    profile = scoring.score_constructs("rightway", evs)
    greetings = next(c for c in profile.constructs if c.construct == "greetings")
    assert greetings.n_trials == 4
    assert greetings.raw_accuracy == 0.5
    assert greetings.score == 0.0  # exactly at chance
    assert profile.n_sessions_pooled == 2


def test_score_constructs_covers_every_construct_even_without_data():
    profile = scoring.score_constructs("rulefixer", [])
    assert {c.construct for c in profile.constructs} == set(
        scoring.SOCIAL_NORMS_CONSTRUCTS["rulefixer"]
    )
    assert all(c.n_trials == 0 and c.score is None for c in profile.constructs)


def test_score_constructs_session_window_keeps_only_most_recent():
    # 4 sessions of "sharing", each all-correct except the earliest which is
    # all-wrong. A window of 2 must exclude the earliest (all-wrong) session.
    evs = (
        construct_answers("rightway", "sharing", 0, 2, session="old", offset=0)
        + construct_answers("rightway", "sharing", 2, 2, session="s2", offset=10)
        + construct_answers("rightway", "sharing", 2, 2, session="s3", offset=20)
        + construct_answers("rightway", "sharing", 2, 2, session="s4", offset=30)
    )
    profile = scoring.score_constructs("rightway", evs, session_window=2)
    sharing = next(c for c in profile.constructs if c.construct == "sharing")
    assert profile.n_sessions_pooled == 2
    assert sharing.n_trials == 4  # only s3 + s4
    assert sharing.raw_accuracy == 1.0


def test_score_social_norms_splits_by_game():
    evs = construct_answers("rightway", "turns", 2, 2, session="s1") + construct_answers(
        "rulefixer", "fairness", 1, 2, session="s1", offset=10
    )
    profiles = scoring.score_social_norms(evs)
    by_game = {p.game_key: p for p in profiles}
    assert set(by_game) == set(scoring.SOCIAL_NORMS_GAMES)
    turns = next(c for c in by_game["rightway"].constructs if c.construct == "turns")
    fairness = next(c for c in by_game["rulefixer"].constructs if c.construct == "fairness")
    assert turns.n_trials == 2
    assert fairness.n_trials == 2
    # rightway trials never leak into rulefixer's profile and vice versa
    assert all(c.n_trials == 0 for c in by_game["rulefixer"].constructs if c.construct != "fairness")


def test_age_and_iq_bands():
    today = date(2026, 1, 1)
    assert scoring.age_band(date(2015, 1, 1), today) == "11-12"
    assert scoring.age_band(date(2016, 6, 1), today) == "8-10"
    assert scoring.age_band(None, today) == "unknown"
    assert scoring.iq_band(65) == "<70"
    assert scoring.iq_band(90) == "85-99"
    assert scoring.iq_band(None) == "unknown"
