"""The ANES bulk tier: every qualifying variable of the cumulative file (CDF), and of the
2024 Time Series Study where the CDF does not carry it, beside the 13 harmonized constructs
in anes.py.

A variable qualifies when it is categorical with 2 to 24 substantive codes. Left out, each
named in reports/anes_bulk.json: administrative variables (ids, weights, form and completion
flags, sample, validation and randomization bookkeeping), interview mode and paradata
(language, interviewer traits, ratings and observations, calls, timing), open-ended codes
(the CDF's MENTION and full-code variables, collapsed or not; the 2024 study's [text],
[coded] and {SPECIFY} variables), counts, continuous variables with no banding of their own,
derived thermometer averages and indexes, the 30 CDF variables the harmonized constructs
already read, and, from the 2024 study, every variable a CDF entry already draws on in 2024,
the RESTRICTED variables (withheld from the public file) and the PAPER: duplicates asked of
the paper-questionnaire respondents alone. Feeling thermometers come in as weighted means,
as the harmonized party thermometers do.

Per variable: construct = the variable name lowercased; label = the Stata variable label,
sentence-cased (the 2024 study's labels are sentence case already and keep their casing);
definition = the label verbatim (a label, not the questionnaire wording). Bands are the
value labels in coded order, the codebook's full text where the Stata file cuts a label
short; a scale labeled only at its ends keeps every integer point, as the GSS tier writes
it ("1 (Government insurance plan)", "2", ...). Out of the base: don't know, refused, NA,
the codebook's missing codes, every negative code, and a stray unlabeled code five or fewer
respondents hold; an offered "haven't thought much about it" stays in, as in the harmonized
ideology item. Rows: the national topline for every study year asked, and the five standard
breakdowns for the latest year whose topline is stored (bulk.cells).

Missing codes, per-variable weights and the 2024 crosswalk come from the CDF variable
codebook (accessible HTML release), fetched once into raw/anes/ beside the Stata file.
"""

from __future__ import annotations

import html
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .. import bulk as bulk_shared
from .. import config
from .. import survey
from ..db import Store
from ..survey import MIN_CELL_N

CDF_CODEBOOK_URL = "https://electionstudies.org/anes_timeseries_cdf_codebook_var_accessible_html/"
STUDY_RELEASE = "20260519"
STUDY_URL = f"https://electionstudies.org/anes_timeseries_2024_stata_{STUDY_RELEASE}/"
STUDY_PAGE = "https://electionstudies.org/data-center/2024-time-series-study/"
VARIABLE_PAGE = "https://electionstudies.org/data-tools/anes-variable/variable.html?year={year}&variable={var}"
FIRST_EXPLORER_YEAR = 1992  # the ANES variable pages cover the 1992-2024 studies


def _dir(raw_dir: Path | None) -> Path:
    return Path(raw_dir) if raw_dir is not None else config.RAW / "anes"


def _get(url: str, target: Path, magic: bytes | None = None) -> Path | None:
    try:
        from curl_cffi import requests as creq
    except ImportError:
        print("curl_cffi is not installed (pip install curl_cffi)")
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}")
    try:
        resp = creq.get(url, impersonate="chrome", timeout=900)
        resp.raise_for_status()
        if magic and not resp.content.startswith(magic):
            raise RuntimeError(f"unexpected content ({resp.headers.get('content-type')})")
        target.write_bytes(resp.content)
    except Exception as exc:
        print(f"download failed: {exc}")
        return None
    return target


# -- the CDF variable codebook --------------------------------------------------------------

@dataclass(frozen=True)
class CodebookEntry:
    var: str
    title: str
    valid: dict            # code -> label, as printed under Valid
    missing: frozenset     # numeric codes printed under Missing (INAP is the blank)
    weight: str            # the full-sample weight the entry names
    sources: dict          # study year -> tuple of that study's variable names


_CODE_START = re.compile(r"^(-?\d+)\.\s*(.*)$")


def _entries(block: str) -> list[str]:
    """Lines of a codebook section; a line not opening with a code continues the last."""
    block = re.sub(r"<span></span>", "", block)
    block = re.sub(r"<br\s*/?>", "\x00", block)
    block = html.unescape(re.sub(r"<[^>]+>", "", block)).replace("\n", " ")
    out: list[str] = []
    for line in (" ".join(x.split()) for x in block.split("\x00")):
        if not line:
            continue
        if out and not (_CODE_START.match(line) or line.upper().startswith("INAP")):
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    return out


def _weight(text: str) -> str:
    for w in ("VCF0010", "VCF0011"):
        if w in text:
            return f"{w}z"
    return "VCF0009z"


def _sources(lines: list[str]) -> dict:
    out: dict[int, tuple[str, ...]] = {}
    for m in re.finditer(r"\b(19\d\d|20\d\d):\s*([^:]+?)(?=\s+(?:19|20)\d\d:|$)", " ".join(lines)):
        names = tuple(re.sub(r"\(.*?\)", "", n).strip() for n in m.group(2).split(","))
        out[int(m.group(1))] = tuple(n for n in names if n)
    return out


def parse_codebook(text: str) -> dict[str, CodebookEntry]:
    """The CDF variable codebook (accessible HTML release) as entries keyed by variable."""
    out: dict[str, CodebookEntry] = {}
    for table in re.findall(r'<table class="table table-condensed\s*">(.*?)</table>', text, re.S):
        head = re.search(r'<td class="first"[^>]*>\s*(.*?)\s*</td>\s*<td class="second">\s*(.*?)\s*</td>',
                         table, re.S)
        if not head:
            continue
        var = re.sub(r"<[^>]+>", "", head.group(1)).strip()
        title = " ".join(html.unescape(re.sub(r"<[^>]+>", "", head.group(2))).split())
        secs = {m.group(1).strip(): _entries(m.group(2)) for m in re.finditer(
            r'<div style="font-weight: bold; ">\s*(.*?)\s*</div>\s*'
            r'<div style="padding-left:70px;[^"]*">(.*?)</div>', table, re.S)}
        valid = {}
        for line in secs.get("Valid", []):
            m = _CODE_START.match(line)
            if m:
                valid[int(m.group(1))] = m.group(2).strip()
        missing = frozenset(int(m.group(1)) for line in secs.get("Missing", [])
                            if (m := _CODE_START.match(line)))
        out[var] = CodebookEntry(var=var, title=title, valid=valid, missing=missing,
                                 weight=_weight(" ".join(secs.get("Weight", []))),
                                 sources=_sources(secs.get("Sources", [])))
    return out


def codebook_path(release: str, raw_dir: Path | None = None) -> Path:
    return _dir(raw_dir) / f"anes_timeseries_cdf_codebook_var_{release}.html"


def load_codebook(release: str, raw_dir: Path | None = None,
                  fetch: bool = True) -> dict[str, CodebookEntry] | None:
    path = codebook_path(release, raw_dir)
    if not path.exists() and not (fetch and _get(CDF_CODEBOOK_URL, path, b"<")):
        return None
    return parse_codebook(path.read_text(encoding="utf-8"))


# -- the 2024 Time Series Study -------------------------------------------------------------

def locate_study(raw_dir: Path | None = None) -> Path | None:
    d = _dir(raw_dir)
    found = sorted(d.rglob("anes_timeseries_2024_stata*.dta"))
    if found:
        return found[-1]
    for z in sorted(d.glob("anes_timeseries_2024_stata*.zip")):
        with zipfile.ZipFile(z) as zf:
            names = [n for n in zf.namelist() if n.lower().endswith(".dta")]
            if names:
                zf.extract(names[0], d)
                return d / names[0]
    return None


def fetch_study(raw_dir: Path | None = None) -> Path | None:
    target = _dir(raw_dir) / f"anes_timeseries_2024_stata_{STUDY_RELEASE}.zip"
    if not target.exists() and _get(STUDY_URL, target, b"PK") is None:
        return None
    return locate_study(raw_dir)


def study_version(path: Path) -> str:
    release = re.findall(r"(\d{8})", path.stem)
    return f"ANES 2024 Time Series Study, release {release[-1] if release else '?'}"


# -- labels -----------------------------------------------------------------------------------

# Words a sentence-cased label keeps capitalized. ANES labels are title case (the CDF) or
# sentence case with acronyms (the 2024 study), so proper nouns have to be named.
PROPER = {
    "america", "american", "americans", "asian", "asian-american", "asian-americans",
    "asians", "bible", "black", "blacks", "catholic", "catholics", "census", "christian",
    "christians", "congress", "congressional", "constitution", "democrat", "democratic",
    "democrats", "english", "europe", "god", "hispanic", "hispanic-american",
    "hispanic-americans", "hispanics", "house", "iran", "iraq", "afghanistan", "israel",
    "jewish", "jews", "latino", "latinos", "latina", "medicaid", "medicare", "mexican",
    "mexican-american", "muslim", "muslims", "native", "protestant", "protestants",
    "puerto", "rican", "republican", "republicans", "russia", "senate", "social",
    "security", "soviet", "spanish", "supreme", "court", "ukraine", "china", "vietnam",
    "washington", "south", "southerners", "nonsouth", "northeast", "west", "midwest",
    "chicanos", "evangelical", "fundamentalists", "obama", "trump", "biden", "harris",
    "clinton", "romney", "mccain", "bush", "gore", "kerry", "humphrey", "kennedy",
    "mccarthy", "mcgovern", "mondale", "muskie", "wallace", "agnew", "ford", "nixon",
    "reagan", "rockefeller", "dole", "carter", "perot", "buchanan", "quayle", "jackson",
    "hillary", "ted", "eugene", "george", "walter", "edmund", "sr", "jr", "spiro", "gerald",
    "richard", "ronald", "nelson", "robert", "jimmy", "bill", "al", "ross", "pat", "dan",
    "jesse", "hubert", "donald", "joe", "kamala", "barack", "mitt", "john", "vance",
    "walz", "pence", "obamacare", "affordable", "care", "act", "cses", "january",
    "capitol", "covid", "covid-19", "israeli", "palestinian", "palestinians", "gaza",
    "hamas", "nato", "un", "christianity", "islam", "mormon", "mormons", "atheists",
    "ukrainian", "taiwan", "mexico", "canada", "japan", "germany", "great", "britain",
    "pacific", "islander", "alaska", "hawaiian", "indian", "indians",
}
# Only proper when they lead a two-word name ("Social Security", "Supreme Court", ...).
PAIRED = {"social": "security", "supreme": "court", "affordable": "care", "puerto": "rican",
          "great": "britain", "native": "american", "care": "act"}


def _keep(word: str, prev: str, nxt: str, all_caps_label: bool) -> bool:
    core = word.strip("()[]{}'\"‘’“”:;,.?!/").lower()
    if not core:
        return False
    letters = re.sub(r"[^A-Za-z]", "", word)
    if re.fullmatch(r"R(?:'?s)?", word.strip("()[]{}\"‘’“”:;,.?!/")):
        return True                      # R, R's, Rs: the respondent
    if (letters and letters.isupper() and not all_caps_label
            and (1 < len(letters) <= 4 or letters == "R" or "." in word)):
        return True                      # an acronym (U.S., FTF, CSES) or R (the respondent)
    p = prev.strip("()[]{}'\"‘’“”:;,.?!/-").lower()
    if core in {"party", "parties"}:
        return p in {"democratic", "republican"}
    if core in PAIRED and nxt.strip("()[]{}'\"‘’“”:;,.?!/").lower() == PAIRED[core]:
        return True
    if core in PAIRED.values() and p in PAIRED and PAIRED[p] == core:
        return True
    if core in PAIRED or core in PAIRED.values():
        return core in PROPER - set(PAIRED) - set(PAIRED.values())
    return core in PROPER or core.removesuffix("'s") in PROPER


# Proper nouns written lowercase in a label take their capital; the ambiguous ones
# (house, south, black, democratic ...) keep the label's own casing.
CAPITALIZE = {
    "america", "american", "americans", "hispanic", "hispanics", "latino", "latinos",
    "asian", "asians", "christian", "christians", "catholic", "catholics", "protestant",
    "protestants", "jewish", "jews", "muslim", "muslims", "bible", "congress", "medicare",
    "medicaid", "obamacare", "english", "spanish", "israel", "israeli", "russia", "china",
    "ukraine", "iraq", "iran", "afghanistan", "vietnam", "mexico", "canada", "japan",
    "taiwan", "gaza", "hamas", "nato", "trump", "biden", "harris", "obama", "clinton",
    "vance", "walz", "palestinian", "palestinians", "washington",
}


def _case(word: str, prev: str, nxt: str, all_caps: bool) -> str:
    if _keep(word, prev, nxt, all_caps):
        letters = re.sub(r"[^A-Za-z]", "", word)
        if letters.isupper() and len(letters) > 4 and "." not in word:
            return word.capitalize()     # a shouted proper noun: HISPANIC -> Hispanic
        return word
    core = word.strip("()[]{}'\"‘’“”:;,.?!/").lower()
    if core in CAPITALIZE and word.islower():
        i = word.lower().index(core)
        return word[:i] + core.capitalize() + word[i + len(core):]
    return word.lower()


def sentence_case(label: str) -> str:
    """Sentence case for a variable label: the first letter up, the rest down, except
    acronyms (U.S., FTF, R for the respondent) and the proper nouns named above."""
    words = label.split()
    if not words:
        return label
    letters = re.sub(r"[^A-Za-z]", "", label)
    all_caps = bool(letters) and letters.isupper()
    out = []
    for i, w in enumerate(words):
        prev = words[i - 1] if i else ""
        nxt = words[i + 1] if i + 1 < len(words) else ""
        parts = w.split("-")
        if len(parts) > 1 and not _keep(w, prev, nxt, all_caps):
            w = "-".join(_case(p, prev, nxt, all_caps) for p in parts)
        else:
            w = _case(w, prev, nxt, all_caps)
        out.append(w)
    first = out[0]
    for j, ch in enumerate(first):
        if ch.isalpha():
            out[0] = first[:j] + ch.upper() + first[j + 1:]
            break
    return " ".join(out)


_LABEL_CODE = re.compile(r"^\s*-?\d+\s*[.:]\s*")


def band_label(raw: str) -> str:
    """'1. Favor' -> 'Favor'; an empty label stays empty (the caller names it by number)."""
    return " ".join(_LABEL_CODE.sub("", str(raw)).split())


_DK = re.compile(r"(?i)^(dk\b|don.?t know\s*($|[;,(/]|if\b|which\b|whether\b|where\b|how\b)|"
                 r"don.?t recognize|refused\b|rf\b|"
                 r"na\b|n/a\b|inap\b|inapplicable\b|no (pre|post)[- ]?(election )?(iw|interview|data)\b|"
                 r"not asked|skipped|"
                 r"technical error|interview breakoff|restricted|no answer|error\b)")
_OFFERED = re.compile(r"(?i)haven.?t thought")


def dk_like(label: str) -> bool:
    """A don't-know, refused, NA or not-asked code, out of the base. "DK; haven't thought
    much about it" is the offered answer on the 7-point scales and stays in."""
    return bool(_DK.match(label)) and not _OFFERED.search(label)


# -- qualification ------------------------------------------------------------------------------

@dataclass(frozen=True)
class BulkVar:
    var: str                 # the name in its file: VCF0876, V241376
    label: str               # sentence-cased variable label
    definition: str          # the variable label verbatim
    kind: str                # "pct" or "mean"
    bands: dict              # code -> band label, coded order (pct)
    weight: str              # weight column
    provenance_url: str
    exclude: frozenset = frozenset()   # codes out of a mean's base
    drop_dim: str | None = None        # a breakdown the variable defines itself

    @property
    def construct(self) -> str:
        return self.var.lower()


@dataclass(frozen=True)
class Skip:
    var: str
    label: str
    reason: str


MAX_BANDS = 24
MIN_BANDS = 2

# CDF administrative variables and paradata, by name.
CDF_ADMIN = {
    "VERSION", "VCF0004", "VCF0006", "VCF0006a",
    "VCF0009x", "VCF0009y", "VCF0009z", "VCF0010x", "VCF0010y", "VCF0010z",
    "VCF0011x", "VCF0011y", "VCF0011z", "VCF9999",
    "VCF0012", "VCF0013", "VCF0014", "VCF0015a", "VCF0015b", "VCF0016",
    "VCF0170a", "VCF0170b", "VCF0170c", "VCF0170d",
    "VCF0900", "VCF0900b", "VCF0900c", "VCF0901a", "VCF0901b",
    "VCF9149", "VCF9152", "VCF9153", "VCF9125",
}
CDF_PARADATA = {
    "VCF0017", "VCF0018a", "VCF0018b", "VCF0050a", "VCF0050b",
    "VCF0070a", "VCF0070b", "VCF0071a", "VCF0071b", "VCF0071c", "VCF0071d",
    "VCF0072a", "VCF0072b", "VCF1015", "VCF1016", "VCF9123", "VCF9124",
}
# CDF titles (the codebook's upper-case headers) and Stata labels.
_CDF_OPEN = re.compile(r"(?i)\bmention\b|full code|candidate code|occupation 71|where born|"
                       r"place of birth|- ethnicity$|religion full")
_CDF_COUNT = re.compile(r"(?i)^(number|count) |\bnumber of (mentions|days|recalled|candidates|"
                        r"politically|articles|children)|\bcount of\b|how many children|"
                        r"likes-dislikes|\(likes|salience")
_CDF_THERMO = re.compile(r"(?i)^thermometer")
_THERMO_DERIVED = re.compile(r"(?i)thermometer (average|index)")


def _explorer_url(entry: CodebookEntry | None) -> str | None:
    if entry is None:
        return None
    for year in sorted(entry.sources, reverse=True):
        names = [n for n in entry.sources[year] if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", n)]
        if year >= FIRST_EXPLORER_YEAR and names:
            return VARIABLE_PAGE.format(year=year, var=names[0])
    return None


def cdf_provenance(var: str, entry: CodebookEntry | None) -> str:
    """The ANES variable page of the question as last asked (1992 on), else the CDF
    codebook opened at the variable."""
    return _explorer_url(entry) or f"{CDF_CODEBOOK_URL}#:~:text={var}"


def _bands(value_labels: dict, observed: set, missing: set) -> dict | str:
    """Substantive codes in coded order, or the reason there are none. Labeled codes that
    are neither missing nor don't-know are bands. Observed codes with no label must lie
    inside a scale labeled at its ends (a 1-7 scale labeled at 1 and 7): every integer
    point of that scale becomes a band, the unlabeled ones named by their number and the
    labeled ones led by theirs ("1 (Government insurance plan)"), as the GSS bulk tier and
    the harmonized EQWLTH item write them. A labeled code past the scale's end (ANES's
    9, "haven't thought much about it") stays its own band."""
    labeled = {}
    for code, raw in value_labels.items():
        try:
            c = int(code)
        except (TypeError, ValueError):
            continue
        if c != code or c in missing:
            continue
        lab = band_label(raw)
        if lab and dk_like(lab):
            continue
        labeled[c] = lab
    unlabeled = {int(c) for c in observed if float(c).is_integer() and int(c) not in labeled
                 and int(c) not in missing and int(c) not in value_labels}
    if any(not float(c).is_integer() for c in observed if c not in missing):
        return "continuous (non-integer values)"
    if not unlabeled:
        return {c: _cap(labeled[c]) or str(c) for c in sorted(labeled)}
    named = sorted(c for c, lab in labeled.items() if lab)
    lo = max((c for c in named if c < min(unlabeled)), default=None)
    hi = min((c for c in named if c > max(unlabeled)), default=None)
    if lo is None or hi is None:
        return "continuous (unlabeled values outside the labeled codes)"
    if hi - lo + 1 > MAX_BANDS:
        return f"continuous ({hi - lo + 1}-point range labeled only at its ends)"
    out = {}
    for c in sorted(set(labeled) | set(range(lo, hi + 1))):
        if c in missing or (c in value_labels and c not in labeled):
            continue
        lab = _cap(labeled.get(c, ""))
        if lo <= c <= hi:
            out[c] = f"{c} ({lab})" if lab and not re.match(rf"{c}\b", lab) else (lab or str(c))
        else:
            out[c] = lab or str(c)
    return out


def _cap(label: str) -> str:
    """First letter up, the rest as written (the GSS bulk tier's option casing)."""
    return label[:1].upper() + label[1:] if label else label


STRAY_MAX = 5


def strays(value_labels: dict, observed, missing: set, answers: set) -> set:
    """Unlabeled codes outside the labeled answers that five or fewer respondents hold: a
    keying slip (a lone 5 on a 1/2 item), not an answer. Needs counts; a plain set of codes
    finds none."""
    if not isinstance(observed, dict):
        return set()
    lo, hi = min(answers), max(answers)
    out = {int(c) for c in observed if float(c).is_integer() and int(c) not in missing
           and int(c) not in value_labels and not lo <= c <= hi}
    return out if out and sum(observed[c] for c in out) <= STRAY_MAX else set()


def classify(value_labels: dict | None, observed: set, missing: set,
             thermometer: bool = False) -> tuple[str, dict | str]:
    """('pct', bands) | ('mean', excluded codes) | ('skip', reason). The caller has already
    applied its file's name and label rules (administrative, open-ended, counts)."""
    if thermometer:
        exclude = {c for c in observed if c in missing or c < 0 or c > 100}
        if value_labels:
            exclude |= {int(c) for c, raw in value_labels.items()
                        if float(c).is_integer() and dk_like(band_label(raw))}
        if any(0 <= c <= 100 for c in observed if c not in exclude):
            return "mean", frozenset(exclude)
        return "skip", "no answers in the file"
    if not value_labels:
        return "skip", "continuous (no value labels)"
    answers = {int(c) for c, raw in value_labels.items() if float(c).is_integer()
               and int(c) not in missing and band_label(raw) and not dk_like(band_label(raw))}
    if not answers:
        return "skip", "no substantive answers"
    missing = set(missing) | strays(value_labels, observed, missing, answers)
    bands = _bands(value_labels, observed, missing)
    if isinstance(bands, str):
        return "skip", bands
    if len(bands) > MAX_BANDS:
        return "skip", f"{len(bands)} categories"
    if len(bands) < MIN_BANDS:
        return "skip", "fewer than 2 categories"
    if not any(float(c).is_integer() and int(c) in bands for c in observed):
        return "skip", "no substantive answers"
    return "pct", bands


def cdf_codes(value_labels: dict | None, entry: CodebookEntry | None,
              observed: set) -> tuple[dict | None, set]:
    """A CDF variable's value labels and missing codes, the Stata file and the codebook
    read together. Negative codes are missing (the 2024 data carry -1, -2, -4 ... into some
    variables unlabeled), and so is an unlabeled 0 below a scale that starts at 1. A code
    the codebook lists as missing is missing unless the Stata file labels it as an answer
    (the codebook prints VCF9241's "10. Right" among the missing codes). A code the Stata
    file leaves unlabeled takes the codebook's valid label where there is one."""
    vl = {k: v for k, v in (value_labels or {}).items() if not isinstance(k, str)}
    if entry:
        for c, lab in entry.valid.items():
            if not lab:
                continue
            if c not in vl:
                vl[c] = f"{c}. {lab}"
            elif _truncated(band_label(vl[c]), lab):
                vl[c] = f"{c}. {lab.replace('’', chr(39)).rstrip('.')}"
    answer = {int(c) for c, raw in vl.items() if float(c).is_integer() and band_label(raw)
              and not dk_like(band_label(raw))}
    missing = {c for c in (entry.missing if entry else ()) if c not in answer}
    missing |= {int(c) for c in observed if c < 0 and float(c).is_integer()}
    missing |= {int(c) for c in vl if c < 0}
    if 0 not in vl and answer and min(answer) >= 1:
        missing.add(0)
    if answer:   # a stray unlabeled 96-99 past a scale's top (one 2024 case or so)
        missing |= {int(c) for c in observed if float(c).is_integer() and c >= 90
                    and c > max(answer) and int(c) not in vl}
    return (vl or None), missing


def _truncated(stata: str, codebook: str) -> bool:
    """The Stata file cuts value labels short; the codebook prints them whole."""
    a = stata.replace("’", "'").rstrip(" ,;.")
    b = codebook.replace("’", "'")
    return len(a) >= 20 and len(b) > len(a) + 3 and b.startswith(a)


def qualify_cdf(column_labels: dict, value_labels: dict, observed: dict,
                codebook: dict[str, CodebookEntry], harmonized: set,
                recode_dims: dict) -> tuple[list[BulkVar], list[Skip]]:
    """Every CDF variable, qualified or skipped with a reason."""
    keep: list[BulkVar] = []
    skips: list[Skip] = []
    for var, raw_label in column_labels.items():
        label = (raw_label or "").strip()
        entry = codebook.get(var)
        title = entry.title if entry else label
        if not label:
            label = title or var
        text = f"{title} | {label}"
        reason = None
        if var.upper() in {v.upper() for v in CDF_ADMIN}:
            reason = "administrative"
        elif var in CDF_PARADATA:
            reason = "interview mode or paradata"
        elif var in harmonized:
            reason = "already a harmonized construct"
        elif _THERMO_DERIVED.search(text):
            reason = "derived thermometer average or index"
        elif _CDF_OPEN.search(text):
            reason = "open-ended code"
        elif _CDF_COUNT.search(text):
            reason = "count"
        if reason:
            skips.append(Skip(var, label, reason))
            continue
        vl, missing = cdf_codes(value_labels.get(var), entry, observed.get(var, set()))
        kind, out = classify(vl, observed.get(var, set()), missing,
                             thermometer=bool(_CDF_THERMO.search(title)))
        if kind == "skip":
            skips.append(Skip(var, label, out))
            continue
        weight = entry.weight if entry else "VCF0009z"
        common = dict(var=var, label=sentence_case(label), definition=label, weight=weight,
                      provenance_url=cdf_provenance(var, entry), drop_dim=recode_dims.get(var))
        if kind == "mean":
            keep.append(BulkVar(kind="mean", bands={}, exclude=out, **common))
        else:
            keep.append(BulkVar(kind="pct", bands=out, **common))
    return keep, skips


# 2024 study names: V240 general and weights, V241 pre-election, V242 post-election, V243
# sample, administration and screener, V244 randomization, V245 interviewer self-description.
STUDY_PRE_WEIGHT = "V240107a"     # full-sample pre-election weight (the ANES variable pages use it)
STUDY_POST_WEIGHT = "V240107b"    # full-sample post-election weight (likewise)
_STUDY_SURVEY = re.compile(r"V24[12]\d{3}[a-z0-9]*")
_STUDY_PARADATA = re.compile(
    r"(?i)iwr\b|interviewer|\bobservation\b|select language|language of|audio consent|"
    r"\bconsent\b|preload|booklet|order of|\border\b.*\b(names|options|questions)\b|"
    r"randomi[sz]|\bmode\b|\bvideo iw\b|sample address|address of registration|address used|"
    r"registration address|voting address|r's address|address given|included in address|"
    r"survey type|checkpoint")
_STUDY_RESTRICTED = re.compile(r"(?i)restricted")
_STUDY_PAPER = re.compile(r"(?i)\bpaper\s*:")
_STUDY_OPEN = re.compile(r"(?i)\[text\]|\[coded\]|\{[^}]*specify\}|verbatim|open[- ]?ended")
_STUDY_COUNT = re.compile(r"(?i)\bhow many (days|times|hours|weeks|months|children|guns|"
                          r"family members)\b|\bnumber of (days|times|hours|children|adults)\b|"
                          r"\(how many days\)")
_STUDY_THERMO = re.compile(r"(?i)thermometer")


def qualify_study(column_labels: dict, value_labels: dict, observed: dict,
                  in_cdf: set) -> tuple[list[BulkVar], list[Skip]]:
    """Every 2024-study variable, qualified or skipped with a reason. Codes below zero
    (refused, don't know, inapplicable, no post interview, ...) are missing throughout."""
    keep: list[BulkVar] = []
    skips: list[Skip] = []
    for var, raw_label in column_labels.items():
        label = (raw_label or "").strip()
        reason = None
        if not _STUDY_SURVEY.fullmatch(var):
            reason = "administrative"            # sample, weights, admin, randomization
        elif var in in_cdf:
            reason = "carried by the CDF"
        elif _STUDY_RESTRICTED.search(label):
            reason = "restricted (not in the public file)"
        elif _STUDY_PARADATA.search(label):
            reason = "interview mode or paradata"
        elif _STUDY_PAPER.search(label):
            reason = "paper-questionnaire duplicate"
        elif _STUDY_OPEN.search(label):
            reason = "open-ended code"
        elif _STUDY_COUNT.search(label):
            reason = "count"
        elif _THERMO_DERIVED.search(label):
            reason = "derived thermometer average or index"
        if reason:
            skips.append(Skip(var, label, reason))
            continue
        vl = value_labels.get(var)
        obs = observed.get(var, set())
        missing = {int(c) for c in obs if c < 0 and float(c).is_integer()}
        if vl:
            missing |= {int(c) for c in vl if float(c).is_integer() and c < 0}
        kind, out = classify(vl, obs, missing, thermometer=bool(_STUDY_THERMO.search(label)))
        if kind == "skip":
            skips.append(Skip(var, label, out))
            continue
        clean = re.sub(r"^(PRE|POST|PRE-POST)\s*:\s*", "", label)
        weight = STUDY_POST_WEIGHT if var.startswith("V242") else STUDY_PRE_WEIGHT
        # The 2024 labels are already sentence case, proper nouns capitalized: only the
        # first letter is raised (the CDF's title-case labels go through sentence_case).
        common = dict(var=var, label=_cap(clean), definition=label, weight=weight,
                      provenance_url=VARIABLE_PAGE.format(year=2024, var=var))
        if kind == "mean":
            keep.append(BulkVar(kind="mean", bands={}, exclude=out, **common))
        else:
            keep.append(BulkVar(kind="pct", bands=out, **common))
    return keep, skips


# -- rows -----------------------------------------------------------------------------------

def observed_codes(df: pd.DataFrame) -> dict:
    """Per numeric column, its distinct non-missing codes and how many respondents hold
    each ({code: count})."""
    out = {}
    for col in df.columns:
        s = df[col]
        if not pd.api.types.is_numeric_dtype(s):
            continue
        codes, counts = np.unique(s.dropna().to_numpy(), return_counts=True)
        out[col] = dict(zip(codes.tolist(), counts.tolist()))
    return out


def _mean_cells(df: pd.DataFrame, bv: BulkVar, subgroups: dict, min_n: int):
    """bulk.cells for a thermometer: means for every year, breakdowns for the latest year
    whose topline is stored."""
    valid = df.loc[~df[bv.var].isin(list(bv.exclude))]
    top, _ = survey.means(valid, bv.var, bv.weight, (0, 100), None, min_n=min_n,
                          label="Mean (0-100)")
    if not top:
        return [], {}, None
    latest = max(c.period for c in top)
    full, skipped = survey.means(valid.loc[valid["year"] == latest], bv.var, bv.weight,
                                 (0, 100), subgroups, min_n=min_n, label="Mean (0-100)")
    return [c for c in top if c.period != latest] + full, skipped, latest


def build_rows(df: pd.DataFrame, bulk: list[BulkVar], *, source: str, version: str,
               subgroups: dict, subgroup_note: str, file_note: str,
               min_n: int = MIN_CELL_N) -> list[dict]:
    """Toplines for every year asked; the breakdowns for the latest year whose topline is
    stored (bulk.cells, the GSS tier's rule). df is the prepared frame: year and the
    subgroup columns already recoded."""
    rows: list[dict] = []
    keys = ["year", *subgroups.values()]
    for bv in bulk:
        if bv.var not in df or bv.weight not in df:
            continue
        d = df[keys + [bv.var, bv.weight]]
        subs = {k: v for k, v in subgroups.items() if k != bv.drop_dim}
        if bv.kind == "pct":
            cells, skipped, latest = bulk_shared.cells(d, bv.var, bv.weight, bv.bands, subs,
                                                       min_n=min_n)
            note = f"{file_note} {bv.var}. Weight {bv.weight}. {subgroup_note} {survey.BASE_NOTE}"
        else:
            cells, skipped, latest = _mean_cells(d, bv, subs, min_n)
            top_code = (" The CDF codes 97-100 degrees as 97, counted as 97."
                        if bv.var.startswith("VCF") else "")
            note = (f"{file_note} {bv.var}. Weight {bv.weight}.{top_code} {subgroup_note} "
                    f"{survey.MEAN_NOTE}")
        if latest is None:
            continue
        rows += survey.norm_rows(
            cells, skipped, source=source, source_version=version, geography="US",
            geo_code="US", place="United States", construct=bv.construct,
            item_text=f"{bv.var}. {bv.definition}", weight_var=bv.weight,
            provenance_url=bv.provenance_url, note=note, period_dates=survey.year_dates,
            estimate_type="pct" if bv.kind == "pct" else "mean")
    return rows


def response_orders(bulk: list[BulkVar]) -> dict[str, list[str]]:
    """construct -> band labels in coded order, for bulk.write_response_order."""
    return {bv.construct: list(dict.fromkeys(bv.bands.values()))
            for bv in bulk if bv.kind == "pct"}


def write_concordance(store: Store, bulk: list[BulkVar], note: str) -> None:
    for bv in bulk:
        survey.merge_concordance(store, bv.construct, bv.label, bv.definition,
                                 anes_var=[bv.var], note=note)


def skip_report(skips: list[Skip]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for s in skips:
        out.setdefault(s.reason, []).append(s.var)
    return out
