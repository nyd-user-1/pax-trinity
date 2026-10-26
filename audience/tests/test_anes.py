"""ANES: recode logic on the synthetic fixture, and the real cumulative file end to end."""

import pandas as pd
import pytest

from audience import db, migrate, survey
from audience.loaders import anes
from survey_helpers import count, fixture_frame, norm_rows, pct_cells, pick, weighted_share

VERSION = "ANES fixture"


@pytest.fixture
def fx():
    return fixture_frame("anes/anes_cdf_SYNTHETIC.csv")


def test_recodes(fx):
    d = anes.prepare(fx).set_index("VCF0006")
    assert pd.isna(d.loc[1, "_age"]) and pd.isna(d.loc[2, "_age"])   # 17, and 0 = NA
    assert d.loc[3, "_race_eth"] == "Hispanic or Latino"
    assert d.loc[4, "_educ"] == "BA"
    assert set(d["_party"].dropna()) <= {"Democrat", "Independent", "Republican"}


def test_offered_answers_stay_and_dont_knows_go(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5))
    ideo = norm_rows(store, "construct = 'ideology_7' AND subgroup_dim = 'all'")
    assert "Haven't thought much about it (incl. don't know)" in {r["response_option"] for r in ideo}
    honest = norm_rows(store, "construct = 'cand_trait_honest' AND subgroup_dim = 'all'")
    for year in (2016, 2020):
        yr = fx[fx["VCF0004"] == year]
        assert {r["n"] for r in honest if r["period_start"].year == year} == {yr["VCF9212"].between(1, 5).sum()}
    egal = pick(norm_rows(store, "construct = 'egalitarianism'"), subgroup_dim="all",
                period_start=pd.Timestamp("2020-01-01").date(), response_option="Agree strongly")
    yr = fx[fx["VCF0004"] == 2020]
    assert egal["estimate"] == pytest.approx(
        weighted_share(yr, "VCF9013", "VCF0009z", [1, 2, 3, 4, 5], [1]), abs=1e-5)
    for total in pct_cells(norm_rows(store)).values():
        assert total == pytest.approx(100.0, abs=1e-4)


def test_thermometer_mean_drops_dk_and_na(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5))
    yr = fx[(fx["VCF0004"] == 2016) & fx["VCF0218"].between(0, 97)]
    expected = (yr["VCF0218"] * yr["VCF0009z"]).sum() / yr["VCF0009z"].sum()
    got = pick(norm_rows(store, "construct = 'thermometer_dem'"), subgroup_dim="all",
               period_start=pd.Timestamp("2016-01-01").date())
    assert got["estimate_type"] == "mean"
    assert got["estimate"] == pytest.approx(expected, abs=1e-5)
    assert got["n"] == len(yr)


def test_rerun_on_the_fixture_is_idempotent(fx, store):
    anes.write_concordance(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5), prune=("ANES", VERSION))
    first = count(store)
    store.upsert_norms(anes.build_rows(fx, VERSION, min_n=5), prune=("ANES", VERSION))
    assert count(store) == first > 0


def test_concordance_names_the_brief_variables(store):
    anes.write_concordance(store)
    got = dict(store.query("SELECT construct, anes_var FROM concordance WHERE anes_var IS NOT NULL"))
    assert "VCF0604" in got["trust_gov"] and "VCF0609" in got["efficacy_external"]
    assert "VCF0613" in got["efficacy_external"] and "VCF0611" in got["parties_care"]


@pytest.fixture(scope="session")
def anes_real(tmp_path_factory):
    path = anes.locate()
    if path is None or survey.SYNTHETIC_MARK in path.name.upper():
        pytest.skip("ANES CDF not under raw/anes/ (python -m audience.load anes fetches it)")
    s = db.connect(duckdb_path=tmp_path_factory.mktemp("anes") / "norms.duckdb")
    migrate.apply(s, quiet=True)
    written = anes.run(s)
    yield s, written
    s.close()


def test_real_run_shape(anes_real):
    store, written = anes_real
    rows = norm_rows(store)
    assert written == len(rows) > 10_000
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N
    harmonized = {i.construct for i in anes.ITEMS}
    years = {r["period_start"].year for r in rows if r["construct"] in harmonized}
    assert min(years) == 1952 and max(years) == 2024
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-3)
    trust = {r["period_start"].year for r in rows if r["construct"] == "trust_gov"}
    assert min(trust) == 1958 and max(trust) == 2012


def test_real_rerun_leaves_the_count_unchanged(anes_real):
    store, written = anes_real
    assert anes.run(store) == written
    assert count(store) == written


# -- the bulk tier: qualification and rows on synthetic frames --------------------------------

from audience.loaders import anes_bulk  # noqa: E402

CODEBOOK_SNIPPET = """
<table class="table table-condensed  ">
<tr class="blocks header"><td class="first" style="font-size: large; ">VCF0876</td>
<td class="second">LAW TO PROTECT HOMOSEXUALS AGAINST DISCRIMINATION</td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Valid</div>
<div style="padding-left:70px;"><span></span> 1. Favor<br>5. Oppose<br>8. DK; depends (1988)</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Missing</div>
<div style="padding-left:70px;"><span></span> 9. NA; no Post IW<br>INAP. question not used</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Weight</div>
<div style="padding-left:70px;">VCF0009x/VCF0009y/VCF0009z</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Sources</div>
<div style="padding-left:70px;">1988: V880852<br>2012:
gayrt_discstd<br>2016: V161229x,V161229,V161229a<br>2024: V241376<br></div></td></tr>
</table>
<table class="table table-condensed  ">
<tr class="blocks header"><td class="first" style="font-size: large; ">VCF0806</td>
<td class="second">GOVERNMENT HEALTH INSURANCE SCALE</td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Valid</div>
<div style="padding-left:70px;"><span></span> 1. Government insurance
plan<br>2.<br>3.<br>7. Private insurance plan<br>9.
DK; haven't thought much about it</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Missing</div>
<div style="padding-left:70px;"><span></span> 0. NA; split versions: not asked (2008);<br>
no Post IW<br>INAP.<br>question not used</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Weight</div>
<div style="padding-left:70px;">VCF0011x/VCF0011y/VCF0011z</div></td></tr>
<tr class="blocks extra"><td colspan="2"><div style="font-weight: bold; ">Sources</div>
<div style="padding-left:70px;">1970: V700134(type 0)<br>1972: V720208<br></div></td></tr>
</table>
"""


def test_codebook_parse():
    cb = anes_bulk.parse_codebook(CODEBOOK_SNIPPET)
    law, scale = cb["VCF0876"], cb["VCF0806"]
    assert law.valid == {1: "Favor", 5: "Oppose", 8: "DK; depends (1988)"}
    assert law.missing == {9} and law.weight == "VCF0009z"
    assert law.sources[2016] == ("V161229x", "V161229", "V161229a")
    assert law.sources[2012] == ("gayrt_discstd",) and law.sources[2024] == ("V241376",)
    assert scale.valid[1] == "Government insurance plan" and scale.valid[2] == ""
    assert scale.missing == {0} and scale.weight == "VCF0011z"
    assert scale.sources == {1970: ("V700134",), 1972: ("V720208",)}
    # the variable page of the question as last asked (1992 on), else the codebook
    assert anes_bulk.cdf_provenance("VCF0876", law).endswith("year=2024&variable=V241376")
    assert anes_bulk.cdf_provenance("VCF0806", scale) == (
        anes_bulk.CDF_CODEBOOK_URL + "#:~:text=VCF0806")


SCALE_LABELS = {0: "0. NA", 1: "1. Government insurance plan", 7: "7. Private insurance plan",
                9: "9. DK; haven't thought much about it"}


def test_classify_bands_follow_the_value_labels():
    kind, bands = anes_bulk.classify(SCALE_LABELS, {0, 1, 2, 3, 4, 5, 6, 7, 9}, {0})
    assert kind == "pct"
    assert list(bands) == [1, 2, 3, 4, 5, 6, 7, 9]                    # coded order
    assert bands[1] == "1 (Government insurance plan)" and bands[4] == "4"   # interior point
    assert bands[9] == "DK; haven't thought much about it"             # offered, past the scale
    kind, bands = anes_bulk.classify({1: "1. Favor", 5: "5. Oppose", 8: "8. DK; depends (1988)",
                                      9: "9. NA"}, {1, 5, 8, 9}, {9})
    assert bands == {1: "Favor", 5: "Oppose"}                          # DK and NA out


def test_classify_skips_and_means():
    therm = {97: "97. 97-100 Degrees", 98: "98. DK", 99: "99. NA"}
    kind, exclude = anes_bulk.classify(therm, set(range(0, 100)), {98, 99}, thermometer=True)
    assert kind == "mean" and exclude == {98, 99}
    assert anes_bulk.classify({97: "97. 97 years old"}, set(range(17, 98)), {0})[0] == "skip"
    many = {i: f"{i}. Code {i}" for i in range(1, 31)}
    assert anes_bulk.classify(many, set(many), set()) == ("skip", "30 categories")
    assert anes_bulk.classify(None, {1, 2}, set()) == ("skip", "continuous (no value labels)")
    index = {0: "0. Least efficacious", 100: "100. Most efficacious", 999: "999. Not scored"}
    assert anes_bulk.classify(index, {0, 25, 50, 75, 100}, set())[1] == (
        "continuous (101-point range labeled only at its ends)")
    assert anes_bulk.dk_like("DK") and anes_bulk.dk_like("Don't know")
    assert anes_bulk.dk_like("NA; no Post IW") and anes_bulk.dk_like("NA; no Pre IW")
    assert not anes_bulk.dk_like("No preference; none; neither")      # an answer
    assert not anes_bulk.dk_like("Don't know what they're doing")     # an offered answer


def test_cdf_title_rules():
    labels = {"VCF0375b": "1972-2004 Mention 1: Like About Democratic Party Collapsed",
              "VCF0723": "Count of Campaign Participation Activities 6-Category",
              "VCF0412": "Thermometer Average - Presidential Candidates",
              "VCF0206": "Thermometer - Blacks"}
    vl = {"VCF0375b": {1: "1. Economic"}, "VCF0723": {0: "0. None", 1: "1. One"},
          "VCF0206": {97: "97. 97-100 Degrees", 98: "98. DK", 99: "99. NA"}}
    obs = {"VCF0375b": {1}, "VCF0723": {0, 1}, "VCF0412": set(range(100)),
           "VCF0206": set(range(100))}
    keep, skips = anes_bulk.qualify_cdf(labels, vl, obs, {}, set(), {})
    assert {s.var: s.reason for s in skips} == {
        "VCF0375b": "open-ended code", "VCF0723": "count",
        "VCF0412": "derived thermometer average or index"}
    assert [(b.var, b.kind) for b in keep] == [("VCF0206", "mean")]


def test_sentence_case():
    sc = anes_bulk.sentence_case
    assert sc("Law to Protect Homosexuals Against Discrimination") == (
        "Law to protect homosexuals against discrimination")
    assert sc("Thermometer - Democratic Party") == "Thermometer - Democratic Party"
    assert sc("Cooperation With U.S.S.R. Scale") == "Cooperation with U.S.S.R. scale"
    assert sc("Federal Spending- Social Security") == "Federal spending- Social Security"
    assert sc("Does R favor/oppose laws protect gays/lesbians") == (
        "Does R favor/oppose laws protect gays/lesbians")


def _bulk_frame(n_per_year=120):
    """Two study years; the item VCF0876 asked in both, codes 1/5 with DK 8 and NA 9."""
    import numpy as np
    rng = np.random.default_rng(7)
    rows = []
    for year in (2016, 2020):
        for i in range(n_per_year):
            rows.append(dict(VCF0004=year, VCF0006=i + 1, VCF0009z=float(rng.uniform(0.5, 2)),
                             VCF0101=int(rng.integers(18, 90)), VCF0104=int(rng.integers(1, 3)),
                             VCF0105b=int(rng.choice([1, 1, 1, 2, 3, 4])),
                             VCF0140a=int(rng.integers(1, 8)), VCF0303=int(rng.integers(1, 4)),
                             VCF0876=int(rng.choice([1, 1, 5, 8, 9]))))
    return anes.prepare(pd.DataFrame(rows))


def test_bulk_rows_toplines_every_year_breakdowns_latest(store):
    df = _bulk_frame()
    bv = anes_bulk.BulkVar(var="VCF0876", label="Law to protect homosexuals",
                           definition="Law to Protect Homosexuals", kind="pct",
                           bands={1: "Favor", 5: "Oppose"}, weight="VCF0009z",
                           provenance_url="https://electionstudies.org/x")
    anes_bulk.write_concordance(store, [bv], "note")
    rows = anes_bulk.build_rows(df, [bv], source="ANES", version=VERSION,
                                subgroups=anes.SUBGROUPS, subgroup_note="", file_note="ANES CDF",
                                min_n=20)
    store.upsert_norms(rows, prune=("ANES", VERSION))
    got = norm_rows(store, "construct = 'vcf0876'")
    tops = [r for r in got if r["subgroup_dim"] == "all"]
    assert {r["period_start"].year for r in tops} == {2016, 2020}
    assert {r["period_start"].year for r in got if r["subgroup_dim"] != "all"} == {2020}
    assert {r["subgroup_dim"] for r in got} >= {"all", "sex", "age", "educ", "party"}
    yr = df[df["year"] == 2016]
    fav = pick(tops, period_start=pd.Timestamp("2016-01-01").date(), response_option="Favor")
    assert fav["estimate"] == pytest.approx(
        weighted_share(yr, "VCF0876", "VCF0009z", [1, 5], [1]), abs=1e-5)
    assert fav["n"] == yr["VCF0876"].isin([1, 5]).sum()
    for total in pct_cells(got).values():
        assert total == pytest.approx(100.0, abs=1e-4)
    # small cells are dropped and named on the latest year's topline
    top20 = pick(tops, period_start=pd.Timestamp("2020-01-01").date(), response_option="Favor")
    small = [r for r in got if r["subgroup_dim"] == "race_eth"]
    assert "race_eth=" in top20["provenance_note"] and len(small) < 8


def test_bulk_rows_drop_their_own_breakdown(store):
    df = _bulk_frame()
    bv = anes_bulk.BulkVar(var="VCF0104", label="Respondent - gender", definition="Respondent - Gender",
                           kind="pct", bands={1: "Male", 2: "Female"}, weight="VCF0009z",
                           provenance_url="https://electionstudies.org/x", drop_dim="sex")
    anes_bulk.write_concordance(store, [bv], "note")
    rows = anes_bulk.build_rows(df, [bv], source="ANES", version=VERSION,
                                subgroups=anes.SUBGROUPS, subgroup_note="", file_note="ANES CDF",
                                min_n=20)
    assert "sex" not in {r["subgroup_dim"] for r in rows}


def test_qualify_cdf_skips_admin_paradata_and_the_harmonized_items():
    labels = {"VCF0004": "Year of Study", "VCF0017": "Mode of Interview",
              "VCF0604": "Trust the Federal Government", "VCF0876": "Law to Protect Homosexuals",
              "VCF0104": "Respondent - Gender"}
    vl = {"VCF0604": {1: "1. None", 2: "2. Some"}, "VCF0876": {1: "1. Favor", 5: "5. Oppose"},
          "VCF0104": {1: "1. Male", 2: "2. Female"}, "VCF0017": {0: "0. Personal", 1: "1. Phone"}}
    obs = {"VCF0604": {1, 2}, "VCF0876": {1, 5}, "VCF0104": {1, 2}, "VCF0017": {0, 1}}
    keep, skips = anes_bulk.qualify_cdf(labels, vl, obs, anes_bulk.parse_codebook(CODEBOOK_SNIPPET),
                                        {i.var for i in anes.ITEMS}, anes.RECODE_DIMS)
    reasons = {s.var: s.reason for s in skips}
    assert reasons == {"VCF0004": "administrative", "VCF0017": "interview mode or paradata",
                       "VCF0604": "already a harmonized construct"}
    by = {b.var: b for b in keep}
    assert by["VCF0876"].construct == "vcf0876" and by["VCF0104"].drop_dim == "sex"
    assert by["VCF0876"].label == "Law to protect homosexuals"
    assert by["VCF0876"].definition == "Law to Protect Homosexuals"


def test_qualify_study_leaves_the_cdf_carried_variables_out():
    labels = {"V240001": "Case ID", "V241376": "PRE: Does R favor/oppose laws protect gays",
              "V241999": "PRE: Should the U.S. do more", "V242999": "POST: Did R do Y",
              "V241013": "PRE: PAPER: Is R registered to vote",
              "V241016": "RESTRICTED: PRE: R's actual address used for voting purposes",
              "V241644c": "PRE: IWR OBS: R reaction to interview - negative [mention]",
              "V242165": "POST: Mention 1 most important problems facing the country [text]",
              "V242500b": "POST: Does R have any sons or daughters - one or more daughters [mention]",
              "V241160": "PRE: Feeling thermometer: Josh Shapiro",
              "V244001": "RAND: Forward or reverse order of response options"}
    vl = {"V241376": {-9: "-9. Refused", 1: "1. Favor", 2: "2. Oppose"},
          "V241999": {-8: "-8. Don't know", 1: "1. Yes", 2: "2. No"},
          "V242999": {-6: "-6. No post interview", 1: "1. Yes", 2: "2. No"}}
    vl["V242500b"] = {0: "0. Not mentioned", 1: "1. Mentioned"}
    obs = {"V241376": {-9, 1, 2}, "V241999": {-8, 1, 2}, "V242999": {-6, 1, 2}, "V240001": {1, 2},
           "V242500b": {-1, 0, 1}}
    vl["V241160"] = {-9: "-9. Refused", 998: "998. Don't know where to rate"}
    obs["V241160"] = {c: 10 for c in [-9, 998, *range(0, 101)]}
    keep, skips = anes_bulk.qualify_study(labels, vl, obs, {"V241376"})
    assert {s.var: s.reason for s in skips} == {
        "V240001": "administrative", "V241376": "carried by the CDF",
        "V241013": "paper-questionnaire duplicate",
        "V241016": "restricted (not in the public file)",
        "V241644c": "interview mode or paradata", "V242165": "open-ended code",
        "V244001": "administrative"}
    assert {b.var for b in keep} == {"V241999", "V242999", "V242500b", "V241160"}  # a checkbox stays
    therm = next(b for b in keep if b.var == "V241160")
    assert therm.kind == "mean" and 998 in therm.exclude and -9 in therm.exclude
    assert therm.label == "Feeling thermometer: Josh Shapiro"          # 2024 casing kept
    by = {b.var: b for b in keep}
    assert by["V241999"].bands == {1: "Yes", 2: "No"}
    assert by["V241999"].label == "Should the U.S. do more"
    assert by["V241999"].definition == "PRE: Should the U.S. do more"
    assert by["V241999"].weight == anes_bulk.STUDY_PRE_WEIGHT
    assert by["V242999"].weight == anes_bulk.STUDY_POST_WEIGHT
    assert by["V242999"].provenance_url.endswith("year=2024&variable=V242999")


# -- the bulk tier against ANES's published figures -------------------------------------------

def _published(counts: dict) -> dict:
    total = sum(counts.values())
    return {k: round(100 * v / total, 1) for k, v in counts.items()}


def _topline(store, construct: str, year: int) -> dict:
    rows = norm_rows(store, "construct = ? AND subgroup_dim = 'all' AND period_start = ?",
                     [construct, pd.Timestamp(f"{year}-01-01").date()])
    return {r["response_option"]: round(r["estimate"], 1) for r in rows}


def test_spot_check_vcf0876_2024_against_the_data_explorer(anes_real):
    """ANES Data Explorer, 2024 V241376 (the CDF's 2024 source for VCF0876), weighted with
    V240107a: Favor 4320.40, Oppose 882.98 (refused, don't know and inapplicable out).
    https://electionstudies.org/data-tools/anes-variable/variable.html?year=2024&variable=V241376
    """
    store, _ = anes_real
    assert _topline(store, "vcf0876", 2024) == _published({"Favor": 4320.40, "Oppose": 882.98})


def test_spot_check_vcf0806_2024_against_the_data_explorer(anes_real):
    """ANES Data Explorer, 2024 V241245 (the CDF's 2024 source for VCF0806), weighted with
    V240107a: 1 Government insurance plan 1086.00, 2 620.47, 3 662.26, 4 868.10, 5 551.96,
    6 412.21, 7 Private insurance plan 560.41, haven't thought much 518.63. The interior
    points carry no label and are named by number, the labeled ends led by theirs; the
    offered "haven't thought" stays in.
    https://electionstudies.org/data-tools/anes-variable/variable.html?year=2024&variable=V241245
    """
    store, _ = anes_real
    got = _topline(store, "vcf0806", 2024)
    assert got == _published({"1 (Government insurance plan)": 1086.00, "2": 620.47,
                              "3": 662.26, "4": 868.10, "5": 551.96, "6": 412.21,
                              "7 (Private insurance plan)": 560.41,
                              "DK; haven't thought much about it": 518.63})


def test_spot_check_2024_study_only_variables_against_the_data_explorer(anes_real):
    """Two variables the CDF does not carry, from the 2024 study itself. ANES Data Explorer,
    weighted (refused, don't know, inapplicable and no-post codes out):
    V241383 (pre-election, V240107a): Favor 1631.13, Oppose 478.61, Neither 512.67.
    V242235 (post-election, V240107b): Extremely good 883.03, Moderately good 1394.01,
    Slightly good 669.80, Neither 896.49, Slightly bad 299.28, Moderately bad 288.27,
    Extremely bad 242.29.
    https://electionstudies.org/data-tools/anes-variable/variable.html?year=2024&variable=V241383
    https://electionstudies.org/data-tools/anes-variable/variable.html?year=2024&variable=V242235
    """
    store, _ = anes_real
    assert _topline(store, "v241383", 2024) == _published(
        {"Favor": 1631.13, "Oppose": 478.61, "Neither favor nor oppose": 512.67})
    assert _topline(store, "v242235", 2024) == _published(
        {"Extremely good": 883.03, "Moderately good": 1394.01, "Slightly good": 669.80,
         "Neither good nor bad": 896.49, "Slightly bad": 299.28, "Moderately bad": 288.27,
         "Extremely bad": 242.29})
    weights = {r["weight_var"] for r in norm_rows(store, "construct IN ('v241383', 'v242235')")}
    assert weights == {"V240107a", "V240107b"}


def test_real_bulk_tier_shape(anes_real):
    store, _ = anes_real
    harmonized = {i.construct for i in anes.ITEMS}
    rows = norm_rows(store, "construct LIKE 'vcf%' OR construct LIKE 'v24%'")
    assert not harmonized & {r["construct"] for r in rows}
    assert min(r["n"] for r in rows) >= survey.MIN_CELL_N
    for total in pct_cells(rows).values():
        assert total == pytest.approx(100.0, abs=1e-3)
    # toplines every year asked, breakdowns only in each variable's latest year
    for c in ("vcf0876", "vcf0806"):
        tops = {r["period_start"].year for r in rows if r["construct"] == c and r["subgroup_dim"] == "all"}
        subs = {r["period_start"].year for r in rows if r["construct"] == c and r["subgroup_dim"] != "all"}
        assert len(tops) > 5 and subs == {max(tops)}
    assert {r["subgroup_dim"] for r in rows if r["construct"] == "vcf0104"} == {
        "all", "age", "race_eth", "educ", "party"}                       # no sex x sex
    # bands keep their coded order in response_order
    order = [o for (o,) in store.query("SELECT response_option FROM response_order WHERE "
                                       "construct = 'vcf0806' ORDER BY ordinal")]
    assert order[0] == "1 (Government insurance plan)" and order[-1].startswith("DK; haven")
