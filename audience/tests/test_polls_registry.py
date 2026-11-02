from audience import polls_registry as P


def test_said_keeps_only_what_reads_as_claimed():
    assert P._said("Web-based interviews", P.MODEWORD, 120) == "Web-based interviews"
    assert P._said("For more information on this news release, please contact: Alec Tyson", P.MODEWORD, 120) is None
    assert P._said("Census Current Population Survey, and 2024 Presidential vote.", P.POPWORD, 100) is None
    assert P._said("U.S. Citizens, age 18 and over", P.POPWORD, 100) == "U.S. Citizens, age 18 and over"
    assert P._said("ts beginning with the August 3-6, 2017 survey were conducted", P.FIELDWORD, 300) is None


def test_union_and_order():
    u = P._Union()
    u.join("VoteHub a", "votehub|k")
    u.join("Release x", "VoteHub a")
    assert u.find("Release x") == u.find("votehub|k")
    rec = P._ordered({"rows": [], "id": "poll_1", "pollster": "YouGov", "sponsors": [], "end": "2026-01-02"})
    assert list(rec) == ["id", "pollster", "end"]          # empty fields drop, the order holds
