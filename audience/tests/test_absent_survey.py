"""GSS and ANES download on their own; when the raw file is absent and the download fails they
print instructions, write nothing, and return 0."""

from audience.loaders import anes, gss


def test_gss_without_file_or_network(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(gss, "fetch", lambda raw_dir=None: None)
    assert gss.run(store, raw_dir=tmp_path) == 0
    assert "GSS_stata.zip" in capsys.readouterr().out
    assert store.query("SELECT count(*) FROM norms")[0][0] == 0


def test_anes_without_file_or_network(store, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(anes, "fetch", lambda raw_dir=None: None)
    assert anes.run(store, raw_dir=tmp_path) == 0
    assert "curl_cffi" in capsys.readouterr().out
    assert store.query("SELECT count(*) FROM norms")[0][0] == 0


def test_gss_unzips_a_cached_zip(tmp_path):
    import zipfile

    with zipfile.ZipFile(tmp_path / "GSS_stata.zip", "w") as zf:
        zf.writestr("GSS_stata/gss7224_r3a.dta", b"not really stata")
    path = gss.locate(tmp_path)
    assert path.name == "gss7224_r3a.dta" and path.exists()
    assert gss.source_version(path) == "GSS 1972-2024 cumulative, Release 3A"


def test_ces_downloads_missing_years_into_raw(store, tmp_path, monkeypatch):
    from audience.loaders import ces

    seen = []
    monkeypatch.setattr(ces, "fetch", lambda year, raw_dir=None: seen.append(year) or None)
    assert ces.run(store, raw_dir=tmp_path, download=True) == 0
    assert seen == sorted(ces.FILES)
    seen.clear()
    ces.run(store, raw_dir=tmp_path)            # a test's raw_dir never downloads by default
    assert seen == []
