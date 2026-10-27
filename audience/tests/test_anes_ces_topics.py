"""ANES and CES topics: each publisher's filing read from its own document, the tags each
construct takes, and the export's merge of every source's tags."""

import pytest

from audience import export, geographies
from audience.loaders import anes, anes_topics as at, ces, ces_topics as ct, gss_topics
from conftest import make_row


@pytest.fixture(scope="module")
def varlist():
    path = anes._dir(None) / at.VARLIST
    if not path.exists():
        pytest.skip("ANES CDF variable list not under raw/anes/topics/ (load anes_topics)")
    return at.parse_varlist(path)


@pytest.fixture(scope="module")
def guide():
    path = ces._dir(None) / ct.GUIDE
    if not path.exists():
        pytest.skip("cumulative CES guide not under raw/ces/docs/ (load ces_topics)")
    return ct.parse_guide(path)


def test_the_anes_variable_list(varlist):
    # "Contents - ANES Cumulative Data File" (electionstudies.org, anes_timeseries_cdf_codebook_Varlist)
    assert len(varlist) == 1029
    assert varlist["vcf0301"] == ["PARTISANSHIP AND ATTITUDES TOWARDS PARTIES"]
    assert varlist["vcf0876"] == ["ISSUES", "ISSUES NONRACIAL CIVIL RIGHTS, RULES AND REGULATIONS"]
    # sections VI and XII print no heading of their own: the subsection stands alone
    assert varlist["vcf9256"] == ["CIVIC PARTICIPATION"]
    assert all(tags and tags[0] != "SYSTEM SUPPORT" for v, tags in varlist.items()
               if "REGISTRATION, TURNOUT, AND VOTE CHOICE" in tags)
    assert varlist["vcf0004"] == ["IDs, Weights, and samples"]


def test_anes_tags_and_reasons(varlist):
    found, why = at.topics({"party_id_7": ["vcf0301"], "cand_trait_honest": ["vcf9212", "vcf9216"],
                            "vcf0876": ["vcf0876"], "vcf0004": ["vcf0004"],
                            "v241004": ["v241004"], "gone": ["vcf0000x"]}, varlist)
    assert found["party_id_7"] == ["PARTISANSHIP AND ATTITUDES TOWARDS PARTIES"]
    assert found["cand_trait_honest"] == ["CANDIDATE AND INCUMBENT EVALUATIONS"]
    assert found["vcf0876"][0] == "ISSUES"
    assert why == {"vcf0004": "filed only under the fielding apparatus",
                   "v241004": "a 2024 Time Series Study variable: no subject filing",
                   "gone": "not in the CDF variable list"}


def test_the_cumulative_ces_guide(guide):
    # Guide to the Cumulative Common Content (Kuriwaki 2026), the outline under "Variables"
    assert len(guide) == 75
    assert guide["newsint"] == "News Interest"
    assert guide["pid7"] == "Partisan Identity"
    assert guide["voted_pres_24"] == "Presidential Vote"
    assert guide["weight"] == "Weights" and guide["year"] == "Administration"


def test_ces_tags_and_reasons(guide):
    found, why = ct.topics({"newsint": ["newsint"], "weight": ["weight"],
                            "cc24_321a": ["cc24_321a"]}, guide)
    assert found == {"newsint": ["News Interest"]}
    assert why == {"weight": "filed only under the fielding apparatus",
                   "cc24_321a": "a yearly Common Content variable: no subject filing"}


def test_a_test_raw_dir_never_downloads(tmp_path):
    assert at.fetch(tmp_path) is None and ct.fetch(tmp_path) is None


def test_the_export_merges_every_source(store, tmp_path):
    for c in ("sex", "party_id_7", "newsint"):
        store.upsert_concordance({"construct": c, "label": c, "definition": c})
    rows = [make_row()]
    for c, src in (("party_id_7", "GSS"), ("newsint", "CES")):
        rows.append(make_row(construct=c, source=src, source_version=f"{src} fixture",
                             geography="US", geo_code="US", estimate_type="pct",
                             response_option="Yes", estimate=50.0))
    store.upsert_norms(rows)
    gss_topics.write(store, {"party_id_7": ["Political"]}, ["party_id_7"])
    gss_topics.write(store, {"party_id_7": ["PARTISANSHIP AND ATTITUDES TOWARDS PARTIES"]},
                     ["party_id_7"], column="anes_topics")
    gss_topics.write(store, {"party_id_7": ["Partisan Identity", "Political"],
                             "newsint": ["News Interest"]}, ["party_id_7", "newsint"],
                     column="ces_topics")
    geographies.refresh(store, quiet=True)
    by = {c["construct"]: c for c in export.export(store, tmp_path / "out")["constructs"]}
    assert by["party_id_7"]["topics"] == ["Political", "PARTISANSHIP AND ATTITUDES TOWARDS PARTIES",
                                          "Partisan Identity"]
    assert by["newsint"]["topics"] == ["News Interest"]
    assert "topics" not in by["sex"]
