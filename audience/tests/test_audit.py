"""The audit tells sources awaiting a raw file (loader exists) from sources with no loader."""

from audience import audit
from conftest import make_row


def test_unloaded_sources_split_by_whether_a_loader_exists(store, capsys):
    store.upsert_norms([make_row()])   # ACS has rows
    store.replace_rows("geographies", ("geo_code", "name", "level", "parent_code"),
                       [("25", "Massachusetts", "STATE", "US")])
    store.execute("INSERT INTO sources (source, name, url, license) VALUES "
                  "('NEWSOURCE', 'A source with no loader', 'https://example.org', 'varies')")
    assert audit.run(store) == 0
    out = capsys.readouterr().out
    awaiting = next(l for l in out.splitlines() if "awaiting raw file" in l)
    missing = next(l for l in out.splitlines() if "missing loader" in l)
    for source, cmd in (("CPS", "cps"), ("GSS", "gss"), ("ANES", "anes"), ("CES", "ces"),
                        ("WVS", "wvs"), ("MA_ENROLLMENT", "ma_enrollment"), ("CVAP", "cvap"),
                        ("POLL", "polls"), ("ELECTION_RESULT", "polls")):
        assert f"{source} (python -m audience.load {cmd})" in awaiting
    assert "ACS" not in awaiting
    assert "VOTERFILE_MA" not in out
    assert missing.strip().endswith("NEWSOURCE")


def test_every_loader_module_names_a_source_in_the_sources_table(store):
    sources = {r[0] for r in store.query("SELECT source FROM sources")}
    assert set(audit.loader_commands()) <= sources


def test_geo_codes_missing_from_geographies_fail_the_audit(store, capsys):
    from audience import geographies

    store.upsert_norms([make_row(geography="COUNTY", geo_code="99999")])   # no such county
    _, unnamed = geographies.refresh(store, quiet=True)
    assert unnamed == ["99999"]
    assert audit.run(store) == 1
    assert "norms geo_codes missing from geographies: 1" in capsys.readouterr().out
