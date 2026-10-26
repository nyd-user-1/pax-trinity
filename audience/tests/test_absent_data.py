"""With no raw data and no way to fetch it, a loader prints instructions, writes nothing,
and returns 0."""

from audience import config
from audience.loaders import acs, cvap


def test_acs_without_key_or_cache_writes_nothing(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(config, "RAW", tmp_path / "raw")
    monkeypatch.setenv("CENSUS_API_KEY", "")
    assert acs.run(store) == 0
    assert "key_signup" in capsys.readouterr().out
    assert store.query("SELECT count(*) FROM norms")[0][0] == 0


def test_cvap_without_cache_or_aws_writes_nothing(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(config, "RAW", tmp_path / "raw")
    monkeypatch.setattr(cvap.shutil, "which", lambda _: None)
    assert cvap.run(store) == 0
    assert "aws s3 cp" in capsys.readouterr().out
    assert store.query("SELECT count(*) FROM norms")[0][0] == 0
