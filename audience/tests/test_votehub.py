from audience.loaders import polls, votehub


def poll(**kw):
    base = dict(id="p1", poll_type="approval", subject="Donald Trump", pollster="Emerson College",
                sponsors=[], population="rv", sample_size=1000, start_date="2026-10-01",
                end_date="2026-10-03", url="https://example.org/release.pdf", internal=False,
                partisan=None, seat_name=None,
                answers=[{"choice": "Approve", "pct": 44.0}, {"choice": "Disapprove", "pct": 52.0}])
    base.update(kw)
    return base


def test_questions():
    assert votehub.question_of("approval", "Donald Trump")["construct"] == "approval_trump"
    senate = votehub.question_of("us-senator", "2026 Texas Republican")
    assert senate["construct"] == "senate_2026_tx_rep_primary" and senate["state"] == "TX"
    assert senate["label"] == "Who leads the 2026 Texas Senate Republican primary?"
    house = votehub.question_of("us-representative", "2026 TX-23")
    assert house["construct"] == "house_2026_tx_23" and house["state"] == "TX"
    assert votehub.question_of("mayor", "2025 New York City")["construct"] == "mayor_2025_nyc"
    assert votehub.question_of("proposition-50", "2025 California")["construct"] == "prop_50_2025_ca"
    assert votehub.question_of("generic-ballot", "2026")["construct"] == "generic_ballot_2026"


def test_build_rows():
    q, rows, skipped = votehub.build([
        poll(),
        poll(id="p2", internal=True),
        poll(id="p3", url=None),
        poll(id="p4", poll_type="generic-ballot", subject="2026", sponsors=["Reuters"],
             start_date="2026-10-05", end_date="2026-10-04",
             answers=[{"choice": "Dem", "pct": 45.0}, {"choice": "Rep", "pct": 43.0}]),
        poll(id="p5", poll_type="governor", subject="2026 Michigan", population="lv",
             answers=[{"choice": "Benson", "pct": 41.0}, {"choice": "James", "pct": 40.0}]),
    ])
    assert set(q) == {"approval_trump", "generic_ballot_2026", "governor_2026_mi"}
    assert skipped == ["p3: no release URL"]
    versions = {r["source_version"] for r in rows}
    assert versions == {"VoteHub p1", "VoteHub p4", "VoteHub p5"}
    gb = [r for r in rows if r["construct"] == "generic_ballot_2026"]
    assert [r["response_option"] for r in gb] == ["Democrat", "Republican"]
    assert gb[0]["item_text"] == "Emerson College for Reuters, registered voters"
    assert gb[0]["period_start"] < gb[0]["period_end"]
    gov = [r for r in rows if r["construct"] == "governor_2026_mi"]
    assert {r["geo_code"] for r in gov} == {"26"} and gov[0]["geography"] == "STATE"
    assert all(r["source"] == "POLL" and "CC BY 4.0" in r["provenance_note"] for r in rows)


def test_polls_loader_keeps_votehub_slices():
    assert polls.owned_elsewhere("POLL", "VoteHub p1")
    assert not polls.owned_elsewhere("POLL", "YouGov 2014-06")
    assert polls.owned_elsewhere("ELECTION_RESULT", "MA 2024 President General Election (PD43+ 165300)")
    assert not polls.owned_elsewhere("ELECTION_RESULT", "AK 2024 general")
