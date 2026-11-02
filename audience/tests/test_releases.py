from audience.loaders import polls, releases as R

COLS = [{"group": "", "label": "Total"}, {"group": "Gender", "label": "Male"},
        {"group": "Gender", "label": "Female"}, {"group": "Party ID", "label": "Dem"},
        {"group": "Region", "label": "West"}]


def q(**kw):
    base = dict(number="3", title="Trump Job Approval (2 Categories)",
                wording="Do you approve or disapprove of the way Donald Trump is handling his job as president?",
                columns=COLS, n=["(1,500)", "(700)", "(800)", "(500)", "(300)"],
                rows=[{"label": "Approve", "values": ["40%", "45%", "35%", "5%", "38%"]},
                      {"label": "Disapprove", "values": ["58%", "53%", "63%", "94%", "60%"]},
                      {"label": "Totals", "values": ["100%"] * 5}])
    base.update(kw)
    return base


def test_column_map_and_shift():
    cmap, shifted = R.column_map(COLS)
    assert cmap == [("all", "all"), ("sex", "Male"), ("sex", "Female"), ("party", "Democrat"), None]
    assert not shifted
    _, shifted = R.column_map(COLS[:1] + [{"group": "2016 Vote", "label": "Liberal"}])
    assert shifted                                    # the header-shift fault
    _, shifted = R.column_map(COLS[:1] + [{"group": "Party ID", "label": "Ind Rep"}])
    assert not shifted                                # unknown label: dropped, not a shift


def test_clean_question_rules():
    good = R.clean_question(q(), {})
    assert [label for label, _ in good["rows"]] == ["Approve", "Disapprove"]   # Totals dropped
    assert good["n"] == [1500, 700, 800, 500, 300]
    assert R.clean_question(q(wording="GALLUP POLL SOCIAL SURVEY"), {}) is None
    assert R.clean_question(q(wording="Immigration policy"), {}) is None      # stem lost
    assert R.clean_question(q(title=None, wording="Donald Trump's job performance?"), {}) is None
    assert R.clean_question(q(title=None, wording="Overall, do you approve of the way Donald Trump is handling ? [GRID]"), {}) is None
    assert R.clean_question(q(title=None, wording="Thinking about the November 2026 General Election for governor, are you"), {}) is None
    assert R.clean_question(q(title=None, wording="In the 2024 General Election for President, did you vote for Kamala Harris or Donald Trump?"), {}) is None
    assert R.clean_question(q(title=None, wording="What is your age range?"), {}) is None
    short = q(rows=[{"label": "Approve", "values": ["40%", "45%"]}])
    assert R.clean_question(short, {}) is None                               # misaligned
    off = q(rows=[{"label": "Approve", "values": ["40%"] * 5}, {"label": "Disapprove", "values": ["20%"] * 5}])
    assert R.clean_question(off, {}) is None                                 # Total sums to 60
    numbered = R.clean_question(q(title=None, wording="1* Do you approve or disapprove of the way President Trump is performing his job?"), {})
    assert numbered["wording"].startswith("Do you approve")
    for labels in (["Approve", "Dis-", "Dis- approve"], ["taking vacation this", "Take my vacation"],
                   ["Perceived motivation", "Perceived motivation Mainly the law"], ["2025 Dec 1-15", "Approve"]):
        rows = [{"label": l, "values": [f"{100 // len(labels)}%"] * 5} for l in labels]
        assert R.clean_question(q(rows=rows), {}) is None, labels
    for code in ("CURY2. ", "(A1). ", "Q12. "):
        w = R.clean_question(q(title=None, wording=code + "Do you approve or disapprove of the way Donald Trump is handling his job?"), {})
        assert w["wording"].startswith("Do you approve")


def test_verify_and_repeats():
    qs = [R.clean_question(q(), {})]
    vh = [{"answers": [{"choice": "Approve", "pct": 40.0}, {"choice": "Disapprove", "pct": 58.0}]}]
    assert R.verify(qs, vh) == "verified"
    vh_lv = [{"answers": [{"choice": "Approve", "pct": 38.0}, {"choice": "Disapprove", "pct": 60.0}]}]
    assert R.verify(qs, vh_lv) == "verified"         # agrees in another column
    bad = [{"answers": [{"choice": "Approve", "pct": 50.0}, {"choice": "Disapprove", "pct": 48.0}]}]
    assert R.verify(qs, bad) == "disagrees"
    surveys = [{"sha": f"{i:064x}", "pollster": "YouGov", "state": None, "start": f"2026-0{i}-01",
                "end": f"2026-0{i}-03", "url": "https://example.org/r.pdf",
                "release": {"name": "CBS News Poll"}, "questions": qs} for i in (1, 2, 3)]
    surveys.append({**surveys[0], "sha": "f" * 64, "state": "TX"})        # another place
    reps = R.repeats(surveys)
    assert len(reps) == 1 and reps[0]["construct"].startswith("yougov_trump_job_approval_2_categories_")
    again = R.repeats(surveys + [{**surveys[0], "sha": "e" * 64, "end": "2026-05-03",
                                  "questions": [R.clean_question(q(title="Another"), {})]}])
    assert reps[0]["construct"] in {r["construct"] for r in again}   # ids hold as the set grows
    rows = R.rows_of(reps[0])
    assert {r["geo_code"] for r in rows} == {"US"}
    assert {(r["subgroup_dim"], r["subgroup_value"]) for r in rows} == {
        ("all", "all"), ("sex", "Male"), ("sex", "Female"), ("party", "Democrat")}
    assert all(R.owns(r["source_version"]) for r in rows)
    assert polls.owned_elsewhere("POLL", rows[0]["source_version"])


def test_cap_holds_oldest_waves():
    qs = [R.clean_question(q(), {})]
    surveys = [{"sha": f"{i:064x}", "pollster": "YouGov", "state": None, "start": f"2026-0{i}-01",
                "end": f"2026-0{i}-03", "url": "https://example.org/r.pdf",
                "release": {"name": "CBS News Poll"}, "questions": qs} for i in (1, 2, 3, 4)]
    rep = R.repeats(surveys)[0]
    one = len(R.rows_of({**rep, "items": rep["items"][:1]}))
    rep = {**rep, "items": list(rep["items"])}
    held = R.cap(rep, limit=1)                 # nothing fits: the newest wave alone stays
    assert held == 3 and [s["end"] for s, _ in rep["items"]] == ["2026-04-03"] and one > 0


def test_stated_sample():
    assert R.stated_sample("1,421 registered voters") == "1,421 registered voters"
    assert R.stated_sample("1500 US Adult citizens") == "1500 US Adult citizens"
    for junk in ("2026 Adults", "2026 MAJORITY OF VOTERS", "2024 Vote Reg Ideology Party ID Total Harris Trump Voters", ""):
        assert R.stated_sample(junk) == ""
