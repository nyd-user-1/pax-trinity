"""Verbatim question wordings for the GSS tier: python -m audience.load gss_wording

Every GSS construct in the store gains the text of its question, the sentence the interviewer
reads (or the web respondent sees), in concordance.gss_wording; the export serves it as the
constructs entry's optional `wording`.

Source: the GSS Data Explorer's public variable list (NORC), one surveyQuestion per mnemonic,
the codebook's question text with its battery stem. It is the list gss.explorer_catalog()
already caches for the bulk tier's links:

  https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/guest-variable?page=<n>&limit=100
  cached as raw/gss/data_explorer_variables.json; a variable's page is
  https://gssdataexplorer.norc.org/variables/<id>/vshow

NORC exposes no other machine-readable route: the API has no per-variable or per-year
endpoint, and the 2024 codebook (GSS 2024 Codebook R3a, under raw/gss/GSS_stata/) prints
question text for some variables and only the short label for most, so it is a cross-check,
not a source. Checked against it and against GSS Methodological Report 133 (Cowan, Hout and
Perrett 2021, https://gss.norc.org/content/dam/gss/get-documentation/pdf/reports/
methodological-reports/MR133%20Abortion.pdf) in tests/test_gss_wording.py.

The Explorer prints the codebook page, not only the question. clean() keeps the words a
respondent hears and removes what surrounds them, never rewording, recasing or reordering:

- Encoding: UTF-8 punctuation read as cp1252 is decoded back (Iâ€™m -> I'm); a character
  the list lost outright (U+FFFD, or its bytes read as cp1252) is restored from its position:
  inside a word an apostrophe, around a phrase quotation marks, else an ellipsis, the mark
  MR133 prints where an item stem runs into its item ("if you were able..."). An apostrophe
  stored doubled (woman''s) is single, as the printed codebook has it.
- Layout: the item letter opening a line (L. Congress) goes and the lines join, so a battery
  item reads as its stem joined to its item, the way gss.ITEMS writes the harmonized ones.
- Interviewer directives go whole, never in part: a parenthesis or bracket that opens with a
  directive word, or is all capitals and carries one ((HAND CARD AD. READ EACH ITEM.),
  [ASK IF NOT OBVIOUS]); a sentence in capitals that carries one, from a sentence start to a
  clean sentence end (READ EACH ITEM; CODE ONE FOR EACH., IF VOTED:); a codebook cross-
  reference ([See REMARKS]). A directive that runs into lowercase without a clean end stays.
  Fills a respondent hears filled in stay: [NAME], (CURRENT MONTH), [CURRENT STATE].
- Notes to analysts that close an entry go: NOTE: ..., As of 2024, BABIES has been recoded ...
- Whitespace is normalized.

Where the Explorer has no text, CODEBOOK quotes NORC's printed codebooks (CLASS, UNION). No
wording is stored where neither has one, where what remains has no lowercase letter (a header
such as RESPONDENT'S DEGREE), where the text describes how a derived variable was built rather
than asking anything (Calculated variable: ..., Constructed from ...), for a harmonized
construct that pools several GSS questions, and for the entries in WITHHELD.
ERRATA corrects a misspelling no instrument printed. reports/gss_wording.json lists every
construct's raw text, its wording, and why any has none.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .. import config, survey
from ..db import Store
from . import gss

SOURCE = "GSS"
REPORT = config.ROOT / "reports" / "gss_wording.json"

# Words an interviewer directive opens with or carries, in the codebook's capitals.
DIRECTIVE_WORDS = (
    r"READ|DON'T READ|DO NOT|CODE|CIRCLE|CHECK|HAND|SHOW|SHUFFLE|PROBE|ASK|RECORD|ENTER|IF|"
    r"REPEAT|CONTINUE|LIST|INTERVIEWERS?|FI|SAY|USE|REFER|PAY|GO TO|CROSS|SPECIFY|CARD|SEE|"
    r"UNTIL|INCLUDE|SKIP|WRITE|NOTE")
OPENS = re.compile(rf"\s*(?:{DIRECTIVE_WORDS})\b")
CARRIES = re.compile(rf"\b(?:{DIRECTIVE_WORDS})\b")
CROSS_REFERENCE = re.compile(r"\s*see\s+[A-Z]", re.I)
MOJIBAKE = re.compile(r"[Â-ô][\u0080-¿ŒœŠšŸŽ"
                      r"žƒˆ˜–—‘-„†-•…"
                      r"‰‹›€™]{1,3}")
LOST_BYTES = "ï¿½"     # U+FFFD in UTF-8, read as cp1252
MARKER = re.compile(r"^\s*(?:[A-Z]{1,2}\d?|\d{1,2}|[a-z])\.\s+")
CLOSING_NOTE = re.compile(r"(?ms)^\s*NOTE:.*\Z|\s*\bAs of 20\d\d, [A-Z][A-Z0-9_]* "
                          r"(?:has|have|will|is|was)\b.*\Z")
DERIVED = re.compile(r"^(?:Calculated variable\b|Constructed from\b|Recoded from\b|"
                     r"\[Recode of\b|[A-Z][A-Z0-9_]* is constructed from\b|"
                     r"Household Size and Composition\b)")
CUT = "\x00"

# Misspellings in the Explorer's list that no instrument printed: the printed 2024 codebook
# has no "Pleae" anywhere. (substring, replacement, why)
ERRATA = (
    ("(Pleae indicate", "(Please indicate",
     "the web grid twins' stem; the printed 2024 codebook has no 'Pleae'"),
)
# Questions the Explorer's list has no text for, quoted from NORC's printed codebooks.
CODEBOOK = {
    "class": ("If you were asked to use one of four names for your social class, which would "
              "you say you belong in: the lower class, the working class, the middle class, or "
              "the upper class?",
              "GSS Cumulative Codebook 1972-2018 (raw/gss/docs/GSS_Codebook_mainbody.pdf), "
              "question 201A [VAR: CLASS]"),
    "union": ("Do you (or your [SPOUSE]) belong to a labor union? (Who?)",
              "GSS 2024 Codebook R3a, UNION; the cumulative codebook's question 214 [VAR: UNION] "
              "reads the same"),
}
# Entries whose Explorer text belongs to another variable.
WITHHELD = {
    "ethregion95": "the Explorer gives ETHREGION95 (Other Oceania) ETHREGION89's item, Jamaica",
}


def _cp1252_bytes(s: str) -> bytes:
    out = bytearray()
    for ch in s:
        try:
            out += ch.encode("cp1252")
        except UnicodeEncodeError:
            if ord(ch) > 0xFF:
                raise
            out.append(ord(ch))   # \x81 \x8d \x8f \x90 \x9d, which cp1252 leaves undefined
    return bytes(out)


def _unmojibake(m: re.Match) -> str:
    s = m.group(0)
    try:
        return _cp1252_bytes(s).decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def _restore_lost(text: str) -> str:
    text = text.replace(LOST_BYTES, "�")
    text = re.sub(r"(?<=[\w\]\)])�(?=(?:s|t|m|d|ll|re|ve)\b)", "’", text)  # I�m
    text = re.sub(r"�([^�]{1,60}?)�", "“\\1”", text)       # �No trust�
    return text.replace("�", "…")                                          # able�Help


def _close(s: str, i: int) -> int | None:
    """Index just past the bracket opened at s[i], or None if it never closes."""
    open_, close = s[i], {"(": ")", "[": "]"}[s[i]]
    depth = 0
    for j in range(i, len(s)):
        if s[j] == open_:
            depth += 1
        elif s[j] == close:
            depth -= 1
            if depth == 0:
                return j + 1
    return None


def _is_directive_bracket(inner: str) -> bool:
    if CROSS_REFERENCE.match(inner) or OPENS.match(inner):
        return True
    return not re.search(r"[a-z]", inner) and bool(CARRIES.search(inner))


def _drop_brackets(line: str) -> str:
    out, i = [], 0
    while i < len(line):
        if line[i] in "([":
            end = _close(line, i)
            if end is not None and _is_directive_bracket(line[i + 1:end - 1]):
                out.append(f" {CUT} ")
                i = end
                continue
        out.append(line[i])
        i += 1
    return "".join(out)


def _capitals(tok: str) -> bool:
    """A token set in capitals, allowing the list's stray lowercase (OnE, CardS, beFORE)."""
    if tok == CUT:
        return False
    lower, upper = len(re.findall(r"[a-z]", tok)), len(re.findall(r"[A-Z]", tok))
    letters = re.sub(r"[^A-Za-z]", "", tok)
    return lower == 0 or upper > lower or (upper >= 2 and letters[0].isupper()
                                           and letters[-1].isupper())


def _ends(tok: str) -> bool:
    return tok == CUT or bool(re.search(r"[.?!:;…][)\]\"'”’]*$", tok))


def _drop_sentences(line: str) -> str:
    """Drop each whole sentence in capitals that carries a directive word."""
    # an all-capitals label glued to the next word: IF FOR:Do you favor
    line = re.sub(r"\b([A-Z]{2,}:)(?=[A-Z][a-z])", r"\1 ", line)
    toks = line.split()
    out, k = [], 0
    while k < len(toks):
        after_please = k > 0 and toks[k - 1] in ("Please", "please")
        start = k == 0 or _ends(toks[k - 1]) or after_please
        if start and re.search(r"[A-Z]", toks[k]) and _capitals(toks[k]):
            j = k
            while j < len(toks) and _capitals(toks[j]):
                j += 1
            end = j if j == len(toks) or toks[j] == CUT else next(
                (x + 1 for x in range(j - 1, k - 1, -1) if _ends(toks[x])), None)
            if end is not None:
                run = " ".join(toks[k:end])
                if CARRIES.search(run) and re.search(r"[A-Z]{2}", run):
                    lead = re.match(r"^[^\w'\"(\[“]*", toks[k]).group(0)   # . . .READ
                    if after_please:
                        out.pop()
                    if lead and lead != toks[k]:
                        out.append(lead)
                    out.append(CUT)
                    k = end
                    continue
        out.append(toks[k])
        k += 1
    return " ".join(out)


def _spoken(raw: str) -> str:
    """The Explorer text with its encoding repaired and the codebook's furniture removed."""
    text = MOJIBAKE.sub(_unmojibake, raw)
    text = _restore_lost(text).replace("''", "'")
    text = CLOSING_NOTE.sub("", text)
    lines = []
    for line in re.split(r"\r\n|\r|\n", text):
        line = MARKER.sub("", line.replace("\xa0", " "))
        lines.append(_drop_sentences(_drop_brackets(line)))
    out = " ".join(lines)
    out = re.sub(rf"([.?!])\s*{CUT}[{CUT}\s]*\.", r"\1", out)       # [ASK IF NOT OBVIOUS].
    out = re.sub(rf"\s*{CUT}[{CUT}\s]*(?=[.,;:?!)])", "", out)
    out = re.sub(rf"\s*{CUT}[{CUT}\s]*", " ", out)
    return re.sub(r"\s+", " ", out).strip()


def clean(raw: str | None) -> str | None:
    """The spoken wording in one Explorer surveyQuestion, or None if it holds none."""
    if not raw or not raw.strip():
        return None
    out = _spoken(raw)
    if not re.search(r"[a-z]", out) or DERIVED.match(out):
        return None
    for wrong, right, _ in ERRATA:
        out = out.replace(wrong, right)
    return out


def _reason(raw: str | None) -> str:
    if raw is None:
        return "no entry in the Data Explorer's variable list"
    if not raw.strip():
        return "the Data Explorer entry has no question text"
    if DERIVED.match(_spoken(raw)):
        return "a derived variable: the text says how it was built, not what was asked"
    return "a header or label in capitals, not a question"


def explorer_texts(raw_dir: Path | None = None, refresh: bool = False) -> dict[str, str]:
    """mnemonic (lowercased) -> its surveyQuestion, from the cached Explorer list."""
    gss.explorer_catalog(raw_dir, refresh=refresh)   # fetches the list if it is not cached
    path = gss._dirs(raw_dir) / gss.EXPLORER_CATALOG
    if not path.exists():
        return {}
    texts: dict[str, str] = {}
    for v in json.loads(path.read_text()):
        q = [x for x in (v.get("surveyQuestion") or []) if x is not None]
        texts.setdefault(v["name"].lower(), q[0] if q else "")
    return texts


def gss_constructs(store: Store) -> dict[str, list[str]]:
    """Every construct with GSS rows -> the GSS variables its concordance row names."""
    rows = store.query(
        "SELECT c.construct, c.gss_var FROM concordance c WHERE c.construct IN "
        "(SELECT DISTINCT construct FROM norms WHERE source = ?) ORDER BY 1", [SOURCE])
    return {c: [v.lower() for v in survey._as_list(g)] for c, g in rows}


def wordings(constructs: dict[str, list[str]], texts: dict[str, str]) -> tuple[dict, dict]:
    """(construct -> wording, construct -> {raw, wording or None, note}) for the report."""
    found, detail = {}, {}
    for construct, gvars in constructs.items():
        if len(gvars) != 1:
            detail[construct] = {"vars": gvars, "raw": None, "wording": None, "source": None,
                                 "note": f"pools {len(gvars)} GSS questions, so no one wording"}
            continue
        var = gvars[0]
        raw = texts.get(var, texts.get(f"{var}_"))   # CLASS and UNION are class_, union_
        wording = None if construct in WITHHELD else clean(raw)
        source = "explorer" if wording else None
        note = WITHHELD.get(construct) or ("" if wording else _reason(raw))
        if not (raw or "").strip() and var in CODEBOOK:
            wording, note = CODEBOOK[var]
            source = "codebook"
        detail[construct] = {"vars": gvars, "raw": raw, "wording": wording, "source": source,
                             "note": note}
        if wording:
            found[construct] = wording
    return found, detail


def write(store: Store, found: dict[str, str], constructs) -> int:
    """Replace the GSS wordings: those found set, every other GSS construct's cleared."""
    pairs = [(c, found.get(c)) for c in constructs]
    with store.transaction():
        for i in range(0, len(pairs), 500):
            part = pairs[i:i + 500]
            store.execute(
                "UPDATE concordance SET gss_wording = v.w FROM (VALUES "
                + ", ".join("(?, ?)" for _ in part)
                + ") AS v(c, w) WHERE concordance.construct = v.c",
                [x for p in part for x in p])
    return sum(1 for _, w in pairs if w)


def write_report(detail: dict, path: Path) -> None:
    missing = {c: d for c, d in detail.items() if not d["wording"]}
    by_reason: dict[str, list[str]] = {}
    for c, d in missing.items():
        by_reason.setdefault(d["note"], []).append(c)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "constructs": len(detail), "worded": len(detail) - len(missing),
        "worded_from": {src: sum(1 for d in detail.values() if d["source"] == src)
                        for src in ("explorer", "codebook")},
        "missing": {k: sorted(v) for k, v in sorted(by_reason.items())},
        "errata": [{"from": a, "to": b, "why": w} for a, b, w in ERRATA],
        "entries": detail,
    }, ensure_ascii=False, indent=1))



def run(store: Store, refresh: bool = False, raw_dir: Path | None = None,
        report: bool = True) -> int:
    texts = explorer_texts(raw_dir, refresh=refresh)
    if not texts:
        print("The GSS Data Explorer variable list is not cached under raw/gss/ and could not "
              "be fetched; no wordings were written.")
        return 0
    constructs = gss_constructs(store)
    found, detail = wordings(constructs, texts)
    written = write(store, found, constructs)
    if report:
        write_report(detail, REPORT)
    where = " (reports/gss_wording.json)" if report else ""
    print(f"GSS wordings: {written:,} of {len(constructs):,} constructs; "
          f"{len(constructs) - written:,} without{where}")
    return written
