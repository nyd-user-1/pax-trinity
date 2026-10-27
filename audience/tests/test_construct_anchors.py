"""The construct layer grown from the field's trend lists (Brief U): anchoring, absorption into
the seed, one construct per shared concept, wording twins and the flags."""

import datetime as dt

import pytest

from audience import canonical, construct_layer as cl, export

KT, GUIDE = canonical.KEY_TRENDS_LIST, canonical.GUIDE_LIST


def trend(key, item, variables, subject="Politics", subtopic="Confidence & Power"):
    return {"list": KT, "subject": subject, "subtopic": subtopic, "item": item, "key": key,
            "variables": variables, "url": f"https://gssdataexplorer.norc.org/trends?measure={key}"}


def chart(key, item, years, subject="Partisanship", subtopic="Party Identification"):
    return {"list": GUIDE, "subject": subject, "subtopic": subtopic, "item": item, "key": key,
            "years": years, "url": canonical.GUIDE_CHART + key}


def table(n, title, variables, question=None):
    return {"id": n, "title": title, "table": f"2A.{n}", "variables": variables,
            "question": question, "capture": "20220101000000", "url": canonical.TOP_TABLE_URL + str(n)}


TRENDS = [
    trend("conlegis", "Confidence in Congress", ["conlegis"]),
    trend("conarmy", "Confidence in the military", ["conarmy"]),
    trend("polviews_r", "Does respondent think of self as liberal or conservative*", ["polviews"],
          subtopic="Political Beliefs"),
    trend("relig_rec", "Religious preference", ["relig", "fund"], "Religion & Spirituality", "Affiliation"),
    trend("fund", "Fundamentalism", ["fund"], "Religion & Spirituality", "Affiliation"),
    trend("childs_rec", "Number of children", ["childs"], "Gender & Marriage", "Children"),
]
CHARTS = [
    chart("lib_con_identification_7_pt", "Liberal-Conservative Self-Identification 7-Point Scale", (1972, 2024),
          "Ideology and Values", "Ideological Self-Identification"),
    chart("party_identification_7_pt", "Party Identification 7-Point Scale", (1952, 2024)),
    chart("approval_of_congress", "Approval of Congress", (1980, 2024), "Evaluations of the Political System", "Congress"),
    chart("brand_new_chart", "A Chart The Old Edition Never Had", (2016, 2024)),
]
TABLES = [
    table(1, "Liberal-Conservative Self-Identification 7-Point Scale", ["VCF0803"]),
    table(2, "Party Identification 7-Point Scale", ["VCF0301"]),
    table(3, "Approval of Congress", ["VCF9221"], "Do you approve or disapprove of the way the U.S. Congress has been handling its job?"),
]
GSS_QUESTIONS = ["confidence_congress", "conarmy", "ideology_7", "relig", "fund", "conarmyy",
                 "party_id_7", "religious_attendance"] + [m.question for c in cl.SEED for m in c.members]
ANES_QUESTIONS = ["ideology_7", "party_id_7", "vcf9221", "vcf0102"]
CES_QUESTIONS = {"cc_military": "Confidence in the military", "cc_ideo": "Ideology, 5-point"}
WORDINGS = {"conarmy": "Confidence in the people running the military?",
            "conarmyy": "(Confidence in the people running) the military?"}


@pytest.fixture
def lists(monkeypatch):
    monkeypatch.setattr(canonical, "key_trends", lambda: [dict(t) for t in TRENDS])
    monkeypatch.setattr(canonical, "guide_items", lambda: [dict(c) for c in CHARTS])
    monkeypatch.setattr(canonical, "guide_tables", lambda: [dict(t) for t in TABLES])


def rows(source, q, year):
    return dict(source=source, source_version="test", geography="US", geo_code="US",
                period_start=dt.date(year, 1, 1), period_end=dt.date(year, 12, 31), construct=q,
                item_text=None, response_option="Yes", subgroup_dim="all", subgroup_value="all",
                estimate=50.0, estimate_type="pct", provenance_url="https://example.org")


@pytest.fixture
def loaded(store):
    for q in sorted(set(GSS_QUESTIONS) | set(ANES_QUESTIONS)):
        store.upsert_concordance({"construct": q, "label": "Congress approval" if q == "vcf9221" else q,
                                  "definition": q, "gss_wording": WORDINGS.get(q)})
    for q, label in CES_QUESTIONS.items():
        store.upsert_concordance({"construct": q, "label": label, "definition": label})
    store.upsert_norms([rows("GSS", q, 2024) for q in sorted(set(GSS_QUESTIONS))]
                       + [rows("ANES", q, 1980 if q == "vcf9221" else 2016) for q in ANES_QUESTIONS]
                       + [rows("CES", q, 2024) for q in CES_QUESTIONS])
    store.replace_rows("geographies", ("geo_code", "name", "level", "parent_code"),
                       [("US", "United States", "US", None)])
    return store


def by_id(library):
    return {c.id: c for c in library}


def test_a_list_item_on_a_seed_question_joins_its_construct(lists, loaded):
    library, _ = cl.build(loaded)
    congress = by_id(library)["confidence_congress"]
    assert [a.key for a in congress.anchors] == ["conlegis"]
    assert congress.anchor.endswith("GSS Key Trends: Confidence in Congress")
    assert congress.label == "Confidence in Congress"           # the seed's own
    assert "conlegis" not in by_id(library)                      # no second construct


def test_the_two_lists_meet_on_a_shared_question(lists, loaded):
    library, _ = cl.build(loaded)
    ideology = by_id(library)["ideology_7"]
    assert [(a.list, a.key) for a in ideology.anchors] == [
        (KT, "polviews_r"), (GUIDE, "lib_con_identification_7_pt")]
    party = by_id(library)["party_id_7"]
    assert [a.key for a in party.anchors] == ["party_identification_7_pt"]


def test_a_new_construct_takes_its_item_and_its_wording_twin(lists, loaded):
    library, _ = cl.build(loaded)
    army = by_id(library)["conarmy"]
    assert army.label == "Confidence in the military"
    assert army.anchors[0].subject == "Politics" and army.anchors[0].subtopic == "Confidence & Power"
    assert [(m.question, m.relation, m.parent) for m in army.members] == [
        ("conarmy", "core", None), ("conarmyy", "mode", "conarmy"), ("cc_military", "version", None)]
    approval = by_id(library)["approval_of_congress"]
    assert approval.members == (cl.Member("vcf9221", "core"),)
    assert approval.definition.startswith("Do you approve")


def test_a_recode_input_stays_with_its_own_item(lists, loaded):
    library, _ = cl.build(loaded)
    assert [m.question for m in by_id(library)["relig"].members] == ["relig"]
    assert [m.question for m in by_id(library)["fund"].members] == ["fund"]


def test_what_cannot_be_settled_is_reported(lists, loaded):
    library, report = cl.build(loaded)
    assert [u["item"] for u in report["guide_unmatched"]] == ["A Chart The Old Edition Never Had"]
    assert {(n["list"], n["item"]) for n in report["not_in_store"]} == {("GSS Key Trends", "Number of children")}
    assert not any(c.id in ("childs", "brand_new_chart") for c in library)
    cl.validate(library, set(GSS_QUESTIONS) | set(ANES_QUESTIONS) | set(CES_QUESTIONS))


def test_anchors_reach_the_export(lists, loaded, tmp_path):
    library, _ = cl.build(loaded)
    cl.register(loaded, library)
    assert loaded.query('SELECT count(*) FROM construct_anchor')[0][0] == sum(len(c.anchors) for c in library)
    index = export.export(loaded, tmp_path)
    families = {f["id"]: f for f in index["families"]}
    ideology = families["ideology_7"]
    assert ideology["subject"] == "Politics" and ideology["subtopic"] == "Political Beliefs"
    assert [a["list"] for a in ideology["anchors"]] == [KT, GUIDE]
    assert set(ideology["anchors"][0]) == {"list", "item", "subject", "subtopic", "url"}
    assert "anchors" not in families["abortion_rossi"]           # no list item names it here
    assert cl.register(loaded, library) == cl.register(loaded, library)


def test_one_item_cannot_anchor_two_constructs():
    a = cl.Anchor(KT, "conarmy", "Confidence in the military", "Politics", None, "https://x")
    seed = (cl.Construct("a", "A", "A", "x", None, (cl.Member("q1", "core"),), (a,)),
            cl.Construct("b", "B", "B", "x", None, (cl.Member("q2", "core"),), (a,)))
    with pytest.raises(cl.SeedRejected, match="anchors two constructs"):
        cl.validate(seed, {"q1", "q2"})


def test_a_ces_question_joins_only_on_its_construct_s_exact_words(lists, loaded):
    library, report = cl.build(loaded)
    army = by_id(library)["conarmy"]
    assert cl.Member("cc_military", "version") in army.members
    assert {"question": "cc_military", "label": "Confidence in the military",
            "construct": "conarmy"} in report["ces_attached"]
    assert not any(m.question == "cc_ideo" for c in library for m in c.members)  # 5-point is not 7


def _more(loaded, questions):
    """Add questions to the loaded store: id -> (source, label, years)."""
    for q, (source, label, years) in questions.items():
        loaded.upsert_concordance({"construct": q, "label": label, "definition": label})
        loaded.upsert_norms([rows(source, q, y) for y in years])


def test_a_chart_without_a_table_takes_the_question_of_exactly_its_years(lists, loaded, monkeypatch):
    monkeypatch.setattr(canonical, "guide_items", lambda: [dict(c) for c in CHARTS] + [
        chart("fed_spend_schools", "Federal spending on public schools", (1984, 2016),
              "Public Opinion on Policy Issues", "Federal Spending")])
    _more(loaded, {"vcf0890": ("ANES", "Federal spending- public schools", [1984, 2016]),
                   "vcf0891": ("ANES", "Federal spending- public schools (old form)", [1984, 2000])})
    library, report = cl.build(loaded)
    schools = by_id(library)["fed_spend_schools"]
    assert schools.members == (cl.Member("vcf0890", "core"),)   # not the one that stops in 2000
    assert [b["question"] for b in report["guide_by_span"]] == ["vcf0890"]
    assert [u["item"] for u in report["guide_unmatched"]] == ["A Chart The Old Edition Never Had"]


def test_one_concept_in_both_lists_is_one_construct(lists, loaded, monkeypatch):
    monkeypatch.setattr(canonical, "key_trends", lambda: [dict(t) for t in TRENDS] + [
        trend("govtpow", "Power of federal government", ["govtpow"], "Politics", "Government")])
    monkeypatch.setattr(canonical, "guide_items", lambda: [dict(c) for c in CHARTS] + [
        chart("power_of_the_fed", "Power of the Federal Government", (1964, 2016),
              "Evaluations of the Political System", "Government")])
    monkeypatch.setattr(canonical, "guide_tables", lambda: [dict(t) for t in TABLES] + [
        table(4, "Power of the Federal Government", ["VCF0829"])])
    _more(loaded, {"govtpow": ("GSS", "Government power", [2024]),
                   "vcf0829": ("ANES", "Government too powerful", [1964, 2016])})
    library, report = cl.build(loaded)
    power = by_id(library)["govtpow"]
    assert [(a.list, a.key) for a in power.anchors] == [(KT, "govtpow"), (GUIDE, "power_of_the_fed")]
    assert [(m.question, m.relation) for m in power.members] == [("govtpow", "core"), ("vcf0829", "version")]
    assert "power_of_the_fed" not in by_id(library)
    assert report["merged_across_lists"][0]["anes_construct"] == "power_of_the_fed"
    assert not any(p["gss"] == "govtpow" for p in report["same_concept"])
