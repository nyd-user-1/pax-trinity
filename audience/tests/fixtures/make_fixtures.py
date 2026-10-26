"""Regenerate the synthetic fixtures: python tests/fixtures/make_fixtures.py

Every file written here is synthetic: real variable names and response codes from each
source's codebook, invented respondents. File names carry SYNTHETIC, and the loaders refuse
such files unless a test passes allow_synthetic=True. The first rows of each file are fixed
edge cases the tests look up by id; the rest are drawn with a fixed seed.
"""

from __future__ import annotations

import csv
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
NA = ""  # empty CSV cell, read back as NaN


def write(path: Path, header: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in rows:
            w.writerow({h: r.get(h, NA) for h in header})


def pick(rng, values, p=None):
    return values[rng.choice(len(values), p=p)]


# -- CES 2022 common content (CES Guide 2022; ces22_common_pre_qx / post_qx) ----------------

def ces(rng) -> None:
    header = ["caseid", "commonweight", "commonpostweight", "vvweight", "birthyr", "gender4",
              "educ", "race", "hispanic", "inputstate", "pid7", "ideo5", "CC22_320a",
              "CC22_423", "TS_p2022", "TS_p2022_party"]
    fixed = [
        # Hispanic by race code; MA; strong Democrat; validated Democratic primary voter.
        dict(caseid=1, race=3, hispanic=NA, inputstate=25, pid7=1, gender4=2, educ=5, birthyr=1980,
             TS_p2022=4, TS_p2022_party=1),
        # White by race, Hispanic by the follow-up -> Hispanic; MA; Republican primary.
        dict(caseid=2, race=1, hispanic=1, inputstate=25, pid7=7, gender4=1, educ=2, birthyr=1950,
             TS_p2022=1, TS_p2022_party=6),
        # Middle Eastern -> White; non-binary -> no sex cell; matched, did not vote (7).
        dict(caseid=3, race=8, hispanic=2, inputstate=25, pid7=4, gender4=3, educ=4, birthyr=2000,
             TS_p2022=7, TS_p2022_party=NA),
        # Not in the post wave (no post weight, no CC22_423); unmatched to the voter file.
        dict(caseid=4, race=2, hispanic=2, inputstate=6, pid7=8, gender4=2, educ=6, birthyr=1965,
             commonpostweight=NA, vvweight=NA, CC22_423=NA, TS_p2022=NA, TS_p2022_party=NA),
    ]
    rows = []
    for i in range(50):
        r = dict(
            caseid=i + 1,
            commonweight=round(float(rng.uniform(0.3, 2.5)), 4),
            commonpostweight=round(float(rng.uniform(0.3, 2.5)), 4),
            vvweight=round(float(rng.uniform(0.3, 2.5)), 4),
            birthyr=int(rng.integers(1940, 2004)),
            gender4=pick(rng, [1, 2, 3], [0.48, 0.5, 0.02]),
            educ=int(rng.integers(1, 7)),
            race=pick(rng, [1, 2, 3, 4, 5, 6, 7, 8], [0.6, 0.12, 0.1, 0.06, 0.02, 0.05, 0.03, 0.02]),
            hispanic=pick(rng, [1, 2], [0.05, 0.95]),
            inputstate=25 if i < 30 else pick(rng, [6, 36, 48]),
            pid7=int(rng.integers(1, 9)),
            ideo5=int(rng.integers(1, 7)),
            CC22_320a=int(rng.integers(1, 6)),
            CC22_423=pick(rng, [1, 2, 3, 8]),
            TS_p2022=pick(rng, [1, 2, 3, 4, 6, 7, NA], [0.1, 0.05, 0.05, 0.1, 0.1, 0.4, 0.2]),
        )
        r["TS_p2022_party"] = (pick(rng, [1, 6, 3]) if r["TS_p2022"] not in (7, NA) else NA)
        if i < len(fixed):
            r.update(fixed[i])
        rows.append(r)
    write(HERE / "ces" / "CES22_Common_SYNTHETIC.csv", header, rows)


# -- WVS wave 7 (WVS7 Codebook Variables report V6.0) ---------------------------------------

WVS_CONF = ["Q64", "Q65", "Q66", "Q67", "Q68", "Q69", "Q70", "Q71", "Q72", "Q73", "Q74",
            "Q75", "Q76", "Q77", "Q78", "Q79", "Q80", "Q81"]


def wvs(rng) -> None:
    header = ["D_INTERVIEW", "B_COUNTRY", "A_YEAR", "W_WEIGHT", "Q260", "Q262", "Q275", "Q57",
              *WVS_CONF, "Q254", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q150", "Q235", "Q236",
              "Q237", "Q238", "Q250", "Q251"]
    rows = []
    for i in range(50):
        us = i < 45
        r = dict(
            D_INTERVIEW=840000 + i if us else 826000 + i,
            B_COUNTRY=840 if us else 826, A_YEAR=2017 if us else 2022,
            W_WEIGHT=round(float(rng.uniform(0.4, 2.2)), 4),
            Q260=pick(rng, [1, 2]), Q262=int(rng.integers(18, 90)), Q275=int(rng.integers(0, 9)),
            Q57=pick(rng, [1, 2, -1], [0.35, 0.6, 0.05]),
            Q254=pick(rng, [1, 2, 3, 4, -1, -2], [0.45, 0.3, 0.12, 0.05, 0.05, 0.03]),
            Q150=pick(rng, [1, 2, -1], [0.3, 0.65, 0.05]),
            Q250=pick(rng, [10, 9, 8, 7, 5, 3, -1], [0.4, 0.15, 0.15, 0.1, 0.1, 0.05, 0.05]),
            Q251=int(rng.integers(1, 11)),
        )
        for q in WVS_CONF:
            r[q] = pick(rng, [1, 2, 3, 4, -1], [0.1, 0.35, 0.35, 0.15, 0.05])
        for q in ("Q1", "Q2", "Q3", "Q4", "Q5", "Q6"):
            r[q] = pick(rng, [1, 2, 3, 4, -2], [0.4, 0.35, 0.15, 0.07, 0.03])
        for q in ("Q235", "Q236", "Q237", "Q238"):
            r[q] = pick(rng, [1, 2, 3, 4, -1], [0.2, 0.3, 0.25, 0.2, 0.05])
        rows.append(r)
    rows[0].update(Q262=17)   # under 18: no age cell
    rows[1].update(Q275=5)    # short-cycle tertiary -> Some college
    rows[2].update(Q275=7)    # master's -> Grad
    write(HERE / "wvs" / "WVS7_USA_SYNTHETIC.csv", header, rows)


# -- MA voter file (party codes D/R/U/L and a city/town column) -----------------------------

def voterfile(rng) -> None:
    header = ["Voter ID", "Last Name", "First Name", "Party Affiliation", "Ward", "Precinct",
              "City/Town", "Voter Status"]
    towns = ["BOSTON"] * 18 + ["WORCESTER"] * 10 + ["CAMBRIDGE"] * 8 + \
            ["MANCHESTER BY THE SEA"] * 6 + ["SPRINGFIELD"] * 6 + ["ATLANTIS"] * 2
    parties = ["U"] * 28 + ["D"] * 14 + ["R"] * 5 + ["L"] * 3
    order = rng.permutation(50)
    rows = []
    for i in range(50):
        rows.append({
            "Voter ID": f"SYN{i + 1:05d}", "Last Name": f"SYNTHETIC-{i + 1:03d}",
            "First Name": "TEST", "Party Affiliation": parties[order[i]],
            "Ward": int(rng.integers(1, 10)), "Precinct": int(rng.integers(1, 6)),
            "City/Town": towns[i], "Voter Status": pick(rng, ["A", "I"], [0.9, 0.1]),
        })
    rows[0]["Party Affiliation"] = " d "  # case and whitespace are normalized
    write(HERE / "ma_voterfile" / "ma_voterfile_20261001_SYNTHETIC.csv", header, rows)


# -- GSS cumulative (GSS 2024 Codebook R3a; Stata missing codes arrive as NaN) ---------------

def gss(rng) -> None:
    header = ["id", "year", "wtssps", "wtssnrps", "sex", "age", "race", "degree", "educ",
              "partyid", "confed", "trust", "polviews", "eqwlth", "attend"]
    rows = []
    for i in range(50):
        year = 2000 if i < 25 else 2010
        r = dict(
            id=i + 1, year=year, wtssps=round(float(rng.uniform(0.4, 2.0)), 4),
            wtssnrps=NA if year < 2004 else round(float(rng.uniform(0.4, 2.0)), 4),
            sex=pick(rng, [1, 2]), age=int(rng.integers(18, 90)), race=pick(rng, [1, 2, 3], [0.7, 0.2, 0.1]),
            degree=int(rng.integers(0, 5)), educ=int(rng.integers(8, 21)),
            partyid=int(rng.integers(0, 8)), confed=pick(rng, [1, 2, 3, NA], [0.15, 0.45, 0.3, 0.1]),
            trust=pick(rng, [1, 2, 3, NA], [0.3, 0.55, 0.05, 0.1]), polviews=int(rng.integers(1, 8)),
            eqwlth=int(rng.integers(1, 8)), attend=int(rng.integers(0, 9)),
        )
        rows.append(r)
    rows[0].update(degree=1, educ=14)   # high school + some college -> Some college
    rows[1].update(degree=1, educ=12)   # high school -> HS or less
    rows[2].update(partyid=7)           # other party -> no party cell
    rows[3].update(age=89)              # 89 or older -> 65+
    rows[4].update(degree=4)            # graduate -> Grad
    write(HERE / "gss" / "gss_SYNTHETIC.csv", header, rows)


# -- ANES CDF (anes_timeseries_cdf_codebook_var_20260205) -----------------------------------

def anes(rng) -> None:
    header = ["VCF0006", "VCF0004", "VCF0009z", "VCF0101", "VCF0104", "VCF0105b", "VCF0140a",
              "VCF0303", "VCF0301", "VCF0803", "VCF0218", "VCF9212", "VCF9013"]
    rows = []
    for i in range(50):
        r = dict(
            VCF0006=i + 1, VCF0004=2016 if i < 25 else 2020,
            VCF0009z=round(float(rng.uniform(0.3, 2.5)), 4), VCF0101=int(rng.integers(18, 81)),
            VCF0104=pick(rng, [1, 2]), VCF0105b=pick(rng, [1, 2, 3, 4], [0.65, 0.12, 0.13, 0.1]),
            VCF0140a=int(rng.integers(1, 8)), VCF0303=pick(rng, [1, 2, 3], [0.45, 0.12, 0.43]),
            VCF0301=int(rng.integers(1, 8)), VCF0803=pick(rng, [1, 2, 3, 4, 5, 6, 7, 9]),
            VCF0218=pick(rng, [0, 15, 30, 50, 60, 70, 85, 97, 98, 99]),
            VCF9212=pick(rng, [1, 2, 3, 4, 5, -8, -9]), VCF9013=pick(rng, [1, 2, 3, 4, 5, 8]),
        )
        rows.append(r)
    rows[0].update(VCF0101=17)   # 17 -> no age cell
    rows[1].update(VCF0101=0)    # NA -> no age cell
    rows[2].update(VCF0105b=3)   # Hispanic
    rows[3].update(VCF0140a=6)   # BA
    rows[4].update(VCF0803=9)    # haven't thought much -> its own option
    rows[5].update(VCF0218=98)   # DK -> out of the thermometer mean
    write(HERE / "anes" / "anes_cdf_SYNTHETIC.csv", header, rows)


# -- IPUMS CPS November supplement (cps.ipums.org variable codes) ----------------------------

def cps(rng) -> None:
    header = ["YEAR", "SERIAL", "MONTH", "PERNUM", "STATEFIP", "AGE", "SEX", "RACE", "HISPAN",
              "EDUC", "FAMINC", "CITIZEN", "POPSTAT", "VOTED", "VOREG", "VOSUPPWT"]
    fixed = [
        dict(AGE=40, CITIZEN=1, POPSTAT=1, VOTED=2, VOREG=99),          # voted -> registered
        dict(AGE=30, CITIZEN=4, POPSTAT=1, VOTED=1, VOREG=2),           # registered non-voter
        dict(AGE=50, CITIZEN=1, POPSTAT=1, VOTED=1, VOREG=1),           # not registered
        dict(AGE=60, CITIZEN=1, POPSTAT=1, VOTED=98, VOREG=98),         # no response
        dict(AGE=70, CITIZEN=1, POPSTAT=1, VOTED=99, VOREG=99),         # supplement non-interview
        dict(AGE=35, CITIZEN=5, POPSTAT=1, VOTED=99, VOREG=99),         # non-citizen: out
        dict(AGE=17, CITIZEN=1, POPSTAT=3, VOTED=99, VOREG=99),         # minor: out
        dict(AGE=25, CITIZEN=1, POPSTAT=2, VOTED=99, VOREG=99),         # armed forces: out
        dict(AGE=45, CITIZEN=1, POPSTAT=1, VOTED=96, VOREG=99, RACE=200, HISPAN=100),  # Hispanic
        dict(AGE=45, CITIZEN=1, POPSTAT=1, VOTED=2, VOREG=99, EDUC=92, FAMINC=841),
        dict(AGE=45, CITIZEN=1, POPSTAT=1, VOTED=2, VOREG=99, FAMINC=800),  # straddling band
    ]
    rows = []
    for i in range(50):
        r = dict(
            YEAR=2020 if i < 30 else 2022, SERIAL=1000 + i, MONTH=11, PERNUM=1,
            STATEFIP=25 if i % 2 == 0 else pick(rng, [6, 36]), AGE=int(rng.integers(18, 86)),
            SEX=pick(rng, [1, 2]), RACE=pick(rng, [100, 200, 651, 300, 801], [0.7, 0.12, 0.08, 0.05, 0.05]),
            HISPAN=pick(rng, [0, 100, 200], [0.85, 0.1, 0.05]),
            EDUC=pick(rng, [60, 73, 81, 92, 111, 123, 125]),
            FAMINC=pick(rng, [300, 600, 710, 740, 820, 830, 841, 842, 843, 996]),
            CITIZEN=pick(rng, [1, 4], [0.9, 0.1]), POPSTAT=1,
            VOTED=pick(rng, [2, 1, 98], [0.65, 0.25, 0.1]),
            VOSUPPWT=round(float(rng.uniform(1500, 4500)), 4),
        )
        r["VOREG"] = 99 if r["VOTED"] == 2 else pick(rng, [2, 1, 98], [0.5, 0.4, 0.1])
        if i < len(fixed):
            r.update(fixed[i])
        rows.append(r)
    write(HERE / "cps" / "cps_ipums_SYNTHETIC.csv", header, rows)


def main() -> None:
    rng = np.random.default_rng(20261025)
    for build in (ces, wvs, voterfile, gss, anes, cps):
        build(rng)


if __name__ == "__main__":
    main()
