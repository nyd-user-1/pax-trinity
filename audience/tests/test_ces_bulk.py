"""CES bulk tier: the qualification rules and labels, a full run over a synthetic year file
and a synthetic cumulative file built here, and spot-checks of the real files against the
unweighted counts the CES guides publish."""

import json

import numpy as np
import pandas as pd
import pytest

from audience import survey
from audience.loaders import ces, ces_bulk
from survey_helpers import count, fixture_frame, norm_rows, pct_cells, pick, weighted_share


# -- rules -----------------------------------------------------------------------------------

def test_sentence_case_keeps_names_and_segment_starts():
    sc = ces_bulk.sentence_case
    assert sc("Job Approval Institutions -- President Biden") == "Job approval institutions -- President Biden"
    assert sc("Know Party in Government -- U.S. House of Representatives") == \
        "Know party in government -- U.S. House of Representatives"
    assert sc("Racial/Sexual agreement -- Women are too easily offended.") == \
        "Racial/sexual agreement -- Women are too easily offended."
    assert sc("Job Approval Institutions -- The Governor of $inputstate") == \
        "Job approval institutions -- The governor of [state]"
    assert sc("Race/ethnicity politicians -- $HouseCand1Name") == \
        "Race/ethnicity politicians -- [House candidate 1]"
    assert sc("Executive Orders Pre -- Repeal the Clean Power Plant Rules") == \
        "Executive orders pre -- Repeal the Clean Power Plant Rules"
    assert sc("VOTED_IN_2020_GENERAL_VOTING_METHOD") == "Voted in 2020 general voting method"
    assert sc("trustfed") == "Trustfed"


def test_bands_drop_missing_codes_and_keep_not_sure():
    got = ces_bulk.bands([[1, "Yes"], [2, "No"], [7, "Don’t know"], [8, "skipped"], [9, "not asked"],
                          [5, "Not sure"], [97, "Prefer not to say"], [-2147483648, "NA"]])
    assert list(got.items()) == [(1, "Yes"), (2, "No"), (5, "Not sure")]


def test_classify_rules():
    yes_no = [[1, "Support"], [2, "Oppose"], [8, "skipped"], [9, "not asked"]]
    meta = {
        "caseid": {"label": "Case ID", "type": "double", "values": []},
        "commonweight": {"label": "Weight - Common", "type": "double", "values": []},
        "page_x_timing": {"label": "Timing Data", "type": "double", "values": []},
        "inputzip": {"label": "Zip code", "type": "double", "values": [[99, "not asked"]]},
        "CCEStake": {"label": "Consent to participate", "type": "double", "values": yes_no},
        "birthyr": {"label": "Birth Year", "type": "double", "values": []},
        "numchildren": {"label": "Number children", "type": "double", "values": [[98, "skipped"]]},
        "dualctry": {"label": "Dual citizenship country", "type": "double",
                     "values": [[i, f"Country {i}"] for i in range(1, 30)]},
        "CC22_365": {"label": "Senate preference", "type": "double",
                     "values": [[1, "$SenCand1Name ($SenCand1Party)"], [2, "$SenCand2Name ($SenCand2Party)"],
                                [3, "Other"]]},
        "pid7": {"label": "7 point Party ID", "type": "double", "values": [[1, "Strong Democrat"], [2, "Weak"]]},
        "CC22_321a": {"label": "Gun Control -- Ban assault rifles", "type": "double", "values": yes_no},
        "CC22_320d": {"label": "Job Approval Institutions -- The Governor of $inputstate",
                      "type": "double", "values": yes_no},
        "CC22_321_t": {"label": "open", "type": "string", "values": []},
    }
    report = ces_bulk.Report()
    got = ces_bulk.classify(meta, report, skip_names={"pid7"})
    assert set(got) == {"CC22_321a", "CC22_320d"}
    bv = got["CC22_321a"]
    assert (bv.construct, bv.label, bv.definition) == (
        "cc22_321a", "Gun control -- Ban assault rifles", "Gun Control -- Ban assault rifles")
    assert bv.options == {1: "Support", 2: "Oppose"}
    assert got["CC22_320d"].label == "Job approval institutions -- The governor of [state]"
    sk = report.skipped
    assert sk["admin"] >= {"caseid", "commonweight", "page_x_timing", "inputzip", "CCEStake",
                           "CC22_321_t"}
    assert sk["unlabeled"] == {"birthyr"} and sk["few"] == {"numchildren"}
    assert sk["many"] == {"dualctry"} and sk["piped"] == {"CC22_365"} and sk["the7"] == {"pid7"}


# -- a full synthetic run --------------------------------------------------------------------

YES_NO = [[1, "Support"], [2, "Oppose"], [8, "skipped"], [9, "not asked"]]
TRUST = [[1, "A great deal"], [2, "A fair amount"], [3, "Not very much"], [4, "None at all"],
         [8, "skipped"], [9, "not asked"]]
NEWS = [[1, "Most of the time"], [2, "Some of the time"], [3, "Only now and then"],
        [4, "Hardly at all"], [7, "Don't know"], [8, "skipped"], [9, "not asked"]]


def _year_dir(tmp_path, rng):
    """The synthetic CES 2022 file plus bulk columns, and its labels JSON."""
    df = fixture_frame("ces/CES22_Common_SYNTHETIC.csv")
    n = len(df)
    df["tookpost"] = np.where(df["commonpostweight"].notna(), 2, 1)
    df["CC22_321a"] = rng.choice([1, 2, 8], n, p=[0.55, 0.4, 0.05])
    df["CC22_424"] = np.where(df["tookpost"] == 2, rng.choice([1, 2, 3, 4], n), np.nan)
    df["newsint"] = rng.choice([1, 2, 3, 4, 7], n)
    df["region"] = rng.choice([1, 2, 3, 4], n)
    df["CC22_partial"] = rng.integers(1, 11, n)
    df.to_csv(tmp_path / "CES22_Common_SYNTHETIC.csv", index=False)
    labels = {
        "caseid": {"label": "Case ID", "type": "double", "values": []},
        "commonweight": {"label": "Weight - Common", "type": "double", "values": []},
        "tookpost": {"label": "Took post-election survey", "type": "double",
                     "values": [[1, "No"], [2, "Yes"]]},
        "pid7": {"label": "7 point Party ID", "type": "double", "values": [[1, "Strong Democrat"],
                                                                            [7, "Strong Republican"]]},
        "CC22_321a": {"label": "Gun Control -- Ban assault rifles", "type": "double", "values": YES_NO},
        "CC22_424": {"label": "truststate", "type": "double", "values": TRUST},
        "newsint": {"label": "Political Interest", "type": "double", "values": NEWS},
        "region": {"label": "Region", "type": "double", "values": [[1, "Northeast"], [2, "Midwest"]]},
        "CC22_partial": {"label": "Partly labeled", "type": "double",
                         "values": [[1, "One"], [2, "Two"], [3, "Three"]]},
        "CC22_gone": {"label": "In the labels, not the CSV", "type": "double", "values": YES_NO},
    }
    path = ces_bulk.labels_path(2022, tmp_path)
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"variables": labels}))
    return df


def _cumulative(tmp_path, rng):
    """A synthetic cumulative file: 2018 (no weight_post) and 2022 (weight_post)."""
    import pyreadstat

    rows = []
    for year in (2018, 2022):
        for i in range(60):
            took = int(rng.random() < 0.8)
            rows.append(dict(
                year=year, state=25 if i < 35 else 6, tookpost=took,
                weight=float(rng.uniform(0.3, 2.5)),
                weight_post=float(rng.uniform(0.3, 2.5)) if (year == 2022 and took) else np.nan,
                gender=float(rng.integers(1, 3)), age=float(rng.integers(18, 90)),
                race=float(rng.integers(1, 9)), hispanic=float(rng.integers(1, 3)),
                educ=float(rng.integers(1, 7)), pid7=float(rng.integers(1, 10)),
                newsint=float(rng.choice([1, 2, 3, 4, 7])),
                voted_turnout_self=float(rng.integers(1, 3)) if took else np.nan,
                sex=float(rng.integers(1, 3)), cong=116.0,
                # "Neither" (6) is given in 2018 only, as 2007's is in the real file
                approval_pres=float(6 if (year == 2018 and i % 10 == 0) else rng.integers(1, 6)),
            ))
    df = pd.DataFrame(rows)
    df["year"] = df["year"].astype(float)
    labels = {
        "gender": {1: "Male", 2: "Female"}, "sex": {1: "Male", 2: "Female"},
        "race": {i: f"Race {i}" for i in range(1, 9)}, "hispanic": {1: "Yes", 2: "No"},
        "educ": {i: f"Educ {i}" for i in range(1, 7)},
        "pid7": {1: "Strong Democrat", 2: "Not Very Strong Democrat", 3: "Lean Democrat",
                 4: "Independent", 5: "Lean Republican", 6: "Not Very Strong Republican",
                 7: "Strong Republican", 8: "Not Sure", 9: "Don't Know"},
        "newsint": {1: "Most of the time", 2: "Some of the time", 3: "Only now and then",
                    4: "Hardly at all", 7: "Don't Know"},
        "voted_turnout_self": {1: "Yes", 2: "No"},
        "tookpost": {0: "Did Not Take Post-Election Survey", 1: "Took Post-Election Survey"},
        "state": {25: "Massachusetts", 6: "California"}, "cong": {116: "116"},
        "approval_pres": {1: "Strongly Approve", 2: "Approve / Somewhat Approve",
                          3: "Disapprove / Somewhat Disapprove", 4: "Strongly Disapprove",
                          5: "Never Heard / Not Sure", 6: "Neither Approve nor Disapprove"},
    }
    col_labels = {"year": "CCES year", "state": "State (FIPS)", "tookpost": "Took post-election wave",
                  "weight": "Survey weight (Year-Specific)", "weight_post": "Survey weight for post-election wave",
                  "gender": "Sex (standardized)", "age": "Age", "race": "Race", "hispanic": "Hispanic",
                  "educ": "Education", "pid7": "Partisan identity (7 point)", "newsint": "News Interest",
                  "voted_turnout_self": "Self-reported turnout (post-election wave)", "sex": "Sex",
                  "cong": "Congressional session", "approval_pres": "President approval"}
    path = tmp_path / "cumulative_2006-2025_SYNTHETIC.dta"
    pyreadstat.write_dta(df, str(path), column_labels=[col_labels[c] for c in df.columns],
                         variable_value_labels=labels)
    return df


@pytest.fixture
def bulk_dir(tmp_path):
    rng = np.random.default_rng(7)
    year = _year_dir(tmp_path, rng)
    cum = _cumulative(tmp_path, rng)
    return tmp_path, year, cum


def _run(store, d, **kw):
    return ces.run(store, raw_dir=d, allow_synthetic=True, min_n=5, **kw)


def test_bulk_run_writes_yearly_and_cumulative_constructs(bulk_dir, store):
    d, year, cum = bulk_dir
    written = _run(store, d)
    rows = norm_rows(store)
    assert written == len(rows)
    versions = {r["source_version"] for r in rows}
    assert versions == {"CES 2022 Common Content", "CES 2022 Common Content, bulk tier",
                        "CES Cumulative Common Content 2006-2025"}
    by = {}
    for r in rows:
        by.setdefault(r["construct"], set()).add(r["source_version"])
    assert by["cc22_321a"] == by["cc22_424"] == {"CES 2022 Common Content, bulk tier"}
    # newsint is served from the cumulative alone; sex belongs to the seed; region and cong
    # are administrative; the partly labeled number is skipped.
    assert by["newsint"] == {"CES Cumulative Common Content 2006-2025"}
    assert "sex" not in by and "region" not in by and "cong" not in by
    assert "cc22_partial" not in by and "cc22_gone" not in by
    assert "pid7" in by   # the cumulative pid7 carries its own years beside party_id_7
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-4)
    concord = {c: (label, definition, ces_var) for c, label, definition, ces_var in store.query(
        "SELECT construct, label, definition, ces_var FROM concordance")}
    assert concord["cc22_321a"][:2] == ("Gun control -- Ban assault rifles",
                                        "Gun Control -- Ban assault rifles")
    assert json.loads(concord["cc22_321a"][2]) == ["CC22_321a"]
    assert concord["newsint"][:2] == ("News interest", "News Interest")
    assert concord["sex"][0] == "Sex" and concord["sex"][2] is None


def test_bulk_toplines_bands_and_weights(bulk_dir, store):
    d, year, cum = bulk_dir
    _run(store, d)
    rows = norm_rows(store, "construct = 'cc22_321a'")
    # bands in coded order, skipped out of the base
    assert {r["response_option"] for r in rows} == {"Support", "Oppose"}
    got = pick(rows, geo_code="US", subgroup_dim="all", response_option="Support")
    assert got["estimate"] == pytest.approx(
        weighted_share(year, "CC22_321a", "commonweight", [1, 2], [1]), abs=1e-5)
    assert got["n"] == (year["CC22_321a"].isin([1, 2]) & (year["commonweight"] > 0)).sum()
    assert got["weight_var"] == "commonweight"
    ma = year[year["inputstate"] == 25]
    got = pick(rows, geo_code="25", subgroup_dim="all", response_option="Oppose")
    assert got["estimate"] == pytest.approx(
        weighted_share(ma, "CC22_321a", "commonweight", [1, 2], [2]), abs=1e-5)
    assert {r["subgroup_dim"] for r in rows} >= {"all", "sex", "age", "educ", "party"}
    # a post-election item takes the post weight
    post = pick(norm_rows(store, "construct = 'cc22_424'"), geo_code="US", subgroup_dim="all",
                response_option="None at all")
    assert post["weight_var"] == "commonpostweight"
    pw = year.assign(commonpostweight=year["commonpostweight"].fillna(0))
    assert post["estimate"] == pytest.approx(
        weighted_share(pw, "CC22_424", "commonpostweight", [1, 2, 3, 4], [4]), abs=1e-5)


def test_bands_keep_their_coded_order_for_the_export(bulk_dir, store):
    d, _, _ = bulk_dir
    _run(store, d)
    if not store.table_exists("response_order"):
        pytest.skip("response_order (migration 007) not in this store")
    order = lambda c: [o for (o,) in store.query(
        "SELECT response_option FROM response_order WHERE source = 'CES' AND construct = ? "
        "ORDER BY ordinal", [c])]
    assert order("cc22_424") == ["A great deal", "A fair amount", "Not very much", "None at all"]
    assert order("newsint") == ["Most of the time", "Some of the time", "Only now and then",
                                "Hardly at all"]
    assert order("party_id_7") == []   # the 7 keep the export's alphabetical order


def test_band_first_letters_are_raised():
    got = ces_bulk.bands([[1, "selected"], [2, "not selected"], [8, "skipped"]])
    assert got == {1: "Selected", 2: "Not selected"}


def test_cumulative_toplines_every_year_breakdowns_latest(bulk_dir, store):
    d, year, cum = bulk_dir
    _run(store, d)
    rows = norm_rows(store, "construct = 'newsint'")
    years = {(r["period_start"].year, r["subgroup_dim"]) for r in rows}
    assert {y for y, dim in years if dim == "all"} == {2018, 2022}
    assert {y for y, dim in years if dim != "all"} == {2022}
    assert "Don't Know" not in {r["response_option"] for r in rows}
    c18 = cum[cum["year"] == 2018]
    got = pick(rows, geo_code="US", subgroup_dim="all", response_option="Most of the time",
               period_start=pd.Timestamp("2018-01-01").date())
    assert got["estimate"] == pytest.approx(
        weighted_share(c18, "newsint", "weight", [1, 2, 3, 4], [1]), abs=1e-5)
    assert got["provenance_url"] == ces_bulk.CUMULATIVE_DOI
    # post item: weight_post in the year that carries it, weight in the year that does not
    vt = norm_rows(store, "construct = 'voted_turnout_self' AND subgroup_dim = 'all' "
                          "AND geo_code = 'US'")
    assert {(r["period_start"].year, r["weight_var"]) for r in vt} == {
        (2018, "weight"), (2022, "weight_post")}
    # a band is listed only in the years someone gave it
    ap = norm_rows(store, "construct = 'approval_pres' AND subgroup_dim = 'all' AND geo_code = 'US'")
    neither = {r["period_start"].year for r in ap if r["response_option"].startswith("Neither")}
    assert neither == {2018} and {r["period_start"].year for r in ap} == {2018, 2022}
    # the party breakdown of pid7 would be pid7 itself
    assert "party" not in {r["subgroup_dim"] for r in norm_rows(store, "construct = 'pid7'")}


def test_the_7_are_unchanged_by_the_bulk_tier(bulk_dir, store, tmp_path_factory):
    from audience import db, migrate

    d, _, _ = bulk_dir
    _run(store, d)
    other = db.connect(duckdb_path=tmp_path_factory.mktemp("only7") / "norms.duckdb")
    migrate.apply(other, quiet=True)
    _run(other, d, bulk=False)
    where = "source_version = 'CES 2022 Common Content'"
    key = lambda r: (r["geo_code"], r["construct"], r["item_text"], r["response_option"],
                     r["subgroup_dim"], r["subgroup_value"], r["estimate"], r["n"], r["moe"])
    assert sorted(map(key, norm_rows(store, where))) == sorted(map(key, norm_rows(other, where)))
    other.close()


def test_bulk_rerun_is_idempotent(bulk_dir, store):
    d, _, _ = bulk_dir
    _run(store, d)
    first = count(store)
    _run(store, d)
    assert count(store) == first


def test_no_labels_no_bulk_rows(store):
    from test_ces import FX_DIR

    ces.run(store, raw_dir=FX_DIR, allow_synthetic=True, min_n=5)
    assert {r[0] for r in store.query("SELECT DISTINCT source_version FROM norms")} == {
        "CES 2022 Common Content"}


# -- the real files against the guides' published counts ------------------------------------

def _real_2024(columns):
    files = ces.locate()
    labels = ces_bulk.labels_path(2024, ces._dir(None))
    if 2024 not in files or survey.SYNTHETIC_MARK in files[2024].name.upper() or not labels.exists():
        pytest.skip("no real CES 2024 file and labels under raw/ces/")
    meta = json.loads(labels.read_text())["variables"]
    found = ces_bulk.classify({c: meta[c] for c in columns}, ces_bulk.Report())
    return ces_bulk.year_frame(files[2024], 2024, columns), found


@pytest.mark.parametrize("var, weight, counts, total", [
    # CES 2024 Guide, Part III: CC24_321a (pre-election), CC24_424 (post-election)
    ("CC24_321a", "commonweight", {"Support": 38128, "Oppose": 21869}, 59997),
    ("CC24_424", "commonpostweight", {"A great deal": 6419, "A fair amount": 21066,
                                      "Not very much": 15247, "None at all": 6608}, 49340),
])
def test_real_2024_bulk_toplines_match_the_guide(var, weight, counts, total):
    df, found = _real_2024([var])
    bv = found[var]
    assert list(bv.options.values()) == list(counts)          # bands in the guide's order
    for band, n in counts.items():                             # unweighted counts per band
        code = next(c for c, b in bv.options.items() if b == band)
        assert int((df[var] == code).sum()) == n
    took = ces_bulk._post_code([[1, "No"], [2, "Yes"]])
    assert ("commonpostweight" if ces_bulk._is_post(df, var, bv.options, took) else
            "commonweight") == weight
    rows, _ = ces_bulk.var_rows(df, bv, weight=weight, latest=2024, version="t",
                                provenance=ces.DATAVERSE[2024], note="", item_text=bv.definition,
                                min_n=survey.MIN_CELL_N)
    top = {r["response_option"]: r for r in rows if r["geo_code"] == "US" and r["subgroup_dim"] == "all"}
    assert set(top) == set(counts)
    base = int((df[var].isin(list(bv.options)) & (df[weight] > 0)).sum())
    assert base <= total and all(r["n"] == base for r in top.values())
    assert sum(r["estimate"] for r in top.values()) == pytest.approx(100.0, abs=1e-6)
    for band, r in top.items():
        assert r["estimate"] == pytest.approx(
            weighted_share(df, var, weight, list(bv.options), [k for k, b in bv.options.items() if b == band]),
            abs=1e-6)


def test_real_cumulative_newsint_matches_the_guide():
    import pyreadstat

    path = ces_bulk.locate_cumulative(ces._dir(None))
    if path is None:
        pytest.skip("no CES cumulative file under raw/ces/")
    df, _ = pyreadstat.read_dta(str(path), usecols=["newsint"])
    # guide_cumulative_2006-2025.pdf, newsint: unweighted counts over all years
    got = df["newsint"].value_counts().to_dict()
    assert {k: got.get(k) for k in (1, 2, 3, 4, 7)} == {
        1: 356238, 2: 177088, 3: 84910, 4: 45032, 7: 18497}
    meta = ces_bulk.stata_meta(path)
    bv = ces_bulk.classify({"newsint": meta["newsint"]}, ces_bulk.Report())["newsint"]
    assert list(bv.options.values()) == ["Most of the time", "Some of the time",
                                         "Only now and then", "Hardly at all"]
