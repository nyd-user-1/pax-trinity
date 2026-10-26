"""The audit tells sources awaiting a raw file (loader exists) from sources with no loader."""

from audience import audit
from conftest import make_row


def test_unloaded_sources_split_by_whether_a_loader_exists(store, capsys):
    store.upsert_norms([make_row()])   # ACS has rows
    store.execute("INSERT INTO sources (source, name, url, license) VALUES "
                  "('POLL', 'Published polls', 'https://example.org', 'varies')")
    assert audit.run(store) == 0
    out = capsys.readouterr().out
    awaiting = next(l for l in out.splitlines() if "awaiting raw file" in l)
    missing = next(l for l in out.splitlines() if "missing loader" in l)
    for source, cmd in (("CPS", "cps"), ("GSS", "gss"), ("ANES", "anes"), ("CES", "ces"),
                        ("WVS", "wvs"), ("VOTERFILE_MA", "voterfile_ma"), ("CVAP", "cvap")):
        assert f"{source} (python -m audience.load {cmd})" in awaiting
    assert "ACS" not in awaiting
    assert missing.strip().endswith("POLL")


def test_every_loader_module_names_a_source_in_the_sources_table(store):
    sources = {r[0] for r in store.query("SELECT source FROM sources")}
    assert set(audit.loader_commands()) <= sources
