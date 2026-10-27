"""GSS topics: the subjects each construct takes, the resumable fetch, the store-to-export path,
and spot-checks of the fetched records against the Data Explorer."""

import json

import pytest

from audience import export, geographies
from audience.loaders import gss_topics as gt
from conftest import make_row


def test_a_construct_takes_its_variables_subjects_in_order():
    by_var = {"abany": ["Abortion", "Split Ballots"], "prouddem": ["Patriotism", "ISSP"],
              "proudpol": ["Patriotism", "Political"], "class_": ["Social Class"], "year": []}
    found = gt.topics({"abany": ["abany"], "national_pride_domain": ["prouddem", "proudpol"],
                       "class": ["class"], "year": ["year"], "gone": ["nosuch"]}, by_var)
    assert found == {"abany": ["Abortion", "Split Ballots"],
                     "national_pride_domain": ["Patriotism", "ISSP", "Political"],
                     "class": ["Social Class"]}


def test_the_fetch_resumes_where_it_stopped(tmp_path, monkeypatch):
    pages = {1: [{"id": 2, "name": "b", "subject": ["X"]}, {"id": 1, "name": "a", "subject": []}],
             2: [{"id": 2, "name": "b", "subject": ["X"]}, {"id": 3, "name": "c", "subject": ["Y"]}],
             3: [{"id": 4, "name": "d", "subject": ["Z"]},
                 {"id": 5, "name": "e", "subject": []}]}
    calls = []

    def flaky(page):
        calls.append(page)
        if page == 3 and calls.count(3) == 1:
            raise ConnectionError("dropped")
        return pages.get(page, [])

    monkeypatch.setattr(gt, "_get", flaky)
    records_by_id = {1: {"subject": ["GSS Next"], "module": ["GSS Next"]},  # the module's name
                     5: {"subject": ["Religion"], "module": ["Core"]}}
    monkeypatch.setattr(gt, "_details", lambda vid: records_by_id[vid])
    monkeypatch.setattr(gt, "FETCH_DELAY", 0)
    monkeypatch.setattr(gt, "CHECKPOINT", 1)
    assert gt.fetch(tmp_path) is None                       # stopped at page 3
    assert (tmp_path / f"{gt.SUBJECTS}.partial").exists()
    path = gt.fetch(tmp_path)                               # resumes at page 3, not page 1
    assert calls == [1, 2, 3, 3, 4, 5, 6]
    records = json.loads(path.read_text())
    assert [r["id"] for r in records] == [1, 2, 3, 4, 5]    # one per id, sorted
    assert not (tmp_path / f"{gt.SUBJECTS}.partial").exists()
    assert gt.fetch(tmp_path) == path and calls[-1] == 6    # cached: no refetch
    # "a" and "e" have no subject in the list, so their own pages are fetched, once each; a
    # page subject that is only the module's name is no topic
    expected = {"a": [], "b": ["X"], "c": ["Y"], "d": ["Z"], "e": ["Religion"]}
    assert gt.subjects(tmp_path) == expected
    assert set(json.loads((tmp_path / gt.DETAILS).read_text())) == {"1", "5"}
    monkeypatch.setattr(gt, "_details", lambda vid: pytest.fail("refetched a cached page"))
    assert gt.subjects(tmp_path) == expected
    assert gt.provenance(tmp_path) == {"a": "page: the module's name", "b": "list", "c": "list",
                                       "d": "list", "e": "page"}
    cons = {"one": ["a"], "two": ["b"], "three": ["e"], "none": ["nosuch"]}
    gt.write_report(cons, gt.topics(cons, gt.subjects(tmp_path)), tmp_path / "report.json",
                    gt.provenance(tmp_path))
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["tagged_from"] == {"list": 1, "page": 1}
    assert report["skipped_as_module_names"] == ["one"]
    assert report["untagged"] == ["none", "one"]


def test_a_repeated_tag_appears_once():
    assert gt._tags(["Jews", "Religion", "Jews", "Religion"]) == ["Jews", "Religion"]


def test_store_to_export(store, tmp_path):
    store.upsert_concordance({"construct": "sex", "label": "Sex", "definition": "Sex"})
    store.upsert_concordance({"construct": "abany", "label": "Abortion if woman wants for any "
                              "reason", "definition": "Abortion if woman wants for any reason"})
    store.upsert_norms([make_row(), make_row(construct="abany", source="GSS",
                                              source_version="GSS fixture", geography="US",
                                              geo_code="US", estimate_type="pct",
                                              response_option="Yes", estimate=60.0)])
    assert gt.write(store, {"abany": ["Abortion", "Split Ballots"]}, ["abany"]) == 1
    geographies.refresh(store, quiet=True)
    index = export.export(store, tmp_path / "audience-data")
    by = {c["construct"]: c for c in index["constructs"]}
    assert by["abany"]["topics"] == ["Abortion", "Split Ballots"]
    assert "topics" not in by["sex"]                                   # no key, not []
    gt.write(store, {}, ["abany"])                                     # a rerun clears it
    index = export.export(store, tmp_path / "audience-data")
    assert all("topics" not in c for c in index["constructs"])


# -- the fetched Data Explorer records -------------------------------------------------------

@pytest.fixture(scope="module")
def by_var():
    path = gt.config.RAW / "gss" / gt.SUBJECTS
    if not path.exists():
        pytest.skip("Data Explorer records not under raw/gss/ (python -m audience.load gss_topics)")
    return gt.subjects()


def test_spot_checks_against_the_data_explorer(by_var):
    # The pages read their subjects from .../prod/variables/guest-details/<id>:
    # https://gssdataexplorer.norc.org/variables/607/vshow  ABANY  ["Abortion", "Split Ballots"]
    # https://gssdataexplorer.norc.org/variables/5321/vshow OTHREL1 ["Religion"]
    # https://gssdataexplorer.norc.org/variables/7177/vshow ABHELP1 ["GSS Next"], only its
    # module's name, so no topic
    # https://gssdataexplorer.norc.org/variables/6170/vshow CODEN   ["Religion"], the page alone
    assert by_var["abany"] == ["Abortion", "Split Ballots"]
    assert by_var["othrel1"] == ["Religion"]
    assert by_var["abhelp1"] == []
    assert by_var["coden"] == ["Religion"]
    assert by_var["conlegis"] == ["Confidence", "Federal Government", "Split Ballots"]


def test_most_variables_have_a_subject(by_var):
    # 6,955 records: 5,650 tagged in the list and CODEN by its own page; of the rest, 613 pages
    # give only their module's name, which is no topic, and 691 give nothing
    tagged = sum(1 for tags in by_var.values() if tags)
    assert len(by_var) == 6_955 and tagged == 5_651
