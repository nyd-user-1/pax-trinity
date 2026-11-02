import datetime as dt

from audience.loaders import pew, polls

TOPLINE = """
 ASK FORM 1 [N=1,770]
 ATO    Automatically registering all eligible citizens to
        vote
               Aug 4-10, 2025                                  31           28            21           19        1
               Sep 24-Oct 7, 2018                              34           31            17           17        *

                                             www.pewresearch.org
ASK FORM 2 [N=1,784]
GOVID  Requiring all voters to show government
       issued photo identification to vote
              Aug 4-10, 2025                                  60         23         11        5          1
"""

TRUST = """### Public trust in government near historic lows

| Date |  | Individual polls | Smoothed trend |
| --- | --- | --- | --- |
| 9/28/2025 | Pew Research Center | 17 | 17 |
| 12/01/1958 | NES | 73 |  |

### Trust in government higher among members of party that controls presidency

| Date |  | Democrat/Lean Dem | Republican/Lean Rep |
| --- | --- | --- | --- |
| 9/28/2025 | Pew Research Center | 9 | 26 |
"""

APPENDIX = """### Views of Congress

| Date | Total Favorable | Total Unfavorable | Rep/Lean Rep | Dem/Lean Dem |
| --- | --- | --- | --- | --- |
| 7/12/2026 | 25 | 72 | 35 | 16 |

### Agreement

|  | Response | 5/1/16 | 7/1/26 |
| --- | --- | --- | --- |
| Policies to do with AI | Agree with Rep Party NET |  | 23 |
| Policies to do with AI | Neither party |  | 51 |
"""


def test_field_periods():
    assert pew.field_period("Sep 24-Oct 7, 2018") == (dt.date(2018, 9, 24), dt.date(2018, 10, 7))
    assert pew.field_period("January 8-12, 2021") == (dt.date(2021, 1, 8), dt.date(2021, 1, 12))
    assert pew.us_date("5/1/16") == dt.date(2016, 5, 1)


def test_topline_battery():
    rows, q = pew.voting_rows(TOPLINE)
    assert set(q) == {"election_policy_automatic_registration", "election_policy_photo_id"}
    assert q["election_policy_photo_id"]["wording"] == (
        pew.VOTING_STEM + " Requiring all voters to show government issued photo identification to vote")
    auto = [r for r in rows if r["construct"] == "election_policy_automatic_registration"]
    assert len(auto) == 9                          # the 2018 "*" no-answer cell is left out
    latest = [r for r in auto if r["period_end"] == dt.date(2025, 8, 10)]
    assert {r["n"] for r in latest} == {1770}      # the form's N, on its own wave only
    assert all(r["n"] is None for r in auto if r not in latest)
    photo = [r for r in rows if r["construct"] == "election_policy_photo_id"]
    assert photo[0]["n"] == 1784 and photo[0]["response_option"] == "Strongly favor"
    assert photo[0]["estimate"] == 60.0 and all(pew.owns(r["source_version"]) for r in rows)


def test_trust_and_appendix():
    rows, _ = pew.trust_rows(TRUST)
    tops = [r for r in rows if r["subgroup_dim"] == "all"]
    assert [r["estimate"] for r in tops] == [17.0, 73.0]   # the polls, not the smoothed trend
    assert tops[1]["item_text"] == "American National Election Studies, compiled by Pew Research Center"
    party = {r["subgroup_value"]: r["estimate"] for r in rows if r["subgroup_dim"] == "party"}
    assert party == {"Democrat": 9.0, "Republican": 26.0}
    rows, q = pew.appendix_rows(APPENDIX)
    congress = [r for r in rows if r["construct"] == "favorability_congress"]
    assert len(congress) == 4 and {r["subgroup_dim"] for r in congress} == {"all", "party"}
    ai = [r for r in rows if r["construct"] == "party_agree_ai"]
    assert [(r["response_option"], r["estimate"]) for r in ai] == [
        ("Agree with the Republican Party", 23.0), ("Neither party", 51.0)]


def test_polls_loader_keeps_pew_slices():
    assert polls.owned_elsewhere("POLL", "Pew ATP 2025-08-04")
