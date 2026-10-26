"""The MA 2024 presidential return and the two raking targets built on the store."""

import pytest

from audience import api, config
from audience.loaders import ma_results as mr

HEADER = ('City/Town,,,"Harris/ Walz","Trump/ Vance","Stein/ Caballero-Roca","All Others",Blanks,"Total Votes Cast"\n'
          ',,,Democratic,Republican,Unenrolled\n')


def test_parse_reads_tickets_parties_and_totals():
    labels, places = mr.parse(HEADER + 'Abington,,,"4,714","4,639",47,34,105,"9,675"\n'
                              'TOTALS,,,"2,126,518","1,251,303","26,545","19,737","39,262","3,512,930"\n')
    assert labels == ["Harris/Walz (Democratic)", "Trump/Vance (Republican)",
                      "Stein/Caballero-Roca (Unenrolled)", "All Others", "Blanks", "Total Votes Cast"]
    assert places["Abington"]["Harris/Walz (Democratic)"] == 4714
    assert places["TOTALS"]["Total Votes Cast"] == 3_512_930


def test_compass_abbreviations_are_spelled_out():
    assert mr.norm_name("W. Springfield") == "WEST SPRINGFIELD"
    assert mr.norm_name("N. Attleborough") == "NORTH ATTLEBOROUGH"
    assert mr.norm_name("Manchester-by-the-Sea") == "MANCHESTER BY THE SEA"


@pytest.fixture(scope="module")
def real():
    if not config.DEFAULT_DUCKDB.exists():
        pytest.skip("no real store")
    s = api.open_store()
    if not s.query("SELECT count(*) FROM norms WHERE construct = 'presidential_vote'")[0][0]:
        s.close()
        pytest.skip("presidential_vote not loaded (python -m audience.load ma_results)")
    yield s
    s.close()


def test_spot_check_the_statewide_return(real):
    """Massachusetts Secretary of the Commonwealth, PD43+ 2024 President General Election,
    statewide totals: Harris/Walz 2,126,518, Trump/Vance 1,251,303, total votes cast 3,512,930.
    https://electionstats.state.ma.us/elections/view/165300/"""
    got = dict((r[0], float(r[1])) for r in real.query(
        "SELECT response_option, estimate FROM norms WHERE construct = 'presidential_vote' "
        "AND geo_code = '25' AND estimate_type = 'count'"))
    assert got["Harris/Walz (Democratic)"] == 2_126_518
    assert got["Trump/Vance (Republican)"] == 1_251_303
    assert got["Total Votes Cast"] == 3_512_930
    towns = real.query("SELECT count(DISTINCT geo_code) FROM norms WHERE construct = 'presidential_vote' "
                       "AND geography = 'TOWN'")[0][0]
    assert towns == 351


def test_party_and_vote_targets(real):
    t = api.get_population_targets("25", dims=["party_id_3", "vote_2024"], store=real)
    for shares in t.values():
        assert sum(shares.values()) == pytest.approx(1.0)
    assert set(t["party_id_3"]) == {"democrat", "independent-other", "republican"}
    cvap = float(real.query("SELECT estimate FROM norms WHERE source = 'CVAP' AND construct = 'cvap' "
                            "AND geo_code = '25' AND subgroup_dim = 'all' AND estimate_type = 'count'")[0][0])
    assert t["vote_2024"]["democrat"] == pytest.approx(2_126_518 / cvap)
    assert t["vote_2024"]["did-not-vote"] == pytest.approx((cvap - 3_512_930) / cvap)
