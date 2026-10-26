"""The geographies lookup over the ACS and CVAP rows: every code named, parents right."""

from audience import geographies
from conftest import need


def test_every_code_is_named_with_its_parent(loaded):
    store, counts = loaded
    need(counts, "ACS")
    need(counts, "CVAP")
    n, unnamed = geographies.refresh(store, quiet=True)
    assert unnamed == []
    codes = store.query("SELECT count(DISTINCT geo_code) FROM norms")[0][0]
    assert n == codes
    got = {r[0]: r[1:] for r in store.query(
        "SELECT geo_code, name, level, parent_code FROM geographies "
        "WHERE geo_code IN ('US', '25', '25025', '2502507000', '250250108011')")}
    assert got["US"] == ("United States", "US", None)
    assert got["25"] == ("Massachusetts", "STATE", "US")
    assert got["25025"] == ("Suffolk County, Massachusetts", "COUNTY", "25")
    assert got["2502507000"] == ("Boston city, Suffolk County, Massachusetts", "TOWN", "25025")
    assert got["250250108011"][1:] == ("BLOCKGROUP", "25025")
    assert geographies.refresh(store, quiet=True)[0] == n   # rebuilds in place
