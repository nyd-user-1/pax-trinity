"""The construct layer: python -m audience.construct_layer

A question is one asked instrument: one wording, one administration, one id (abany, abanyg,
conlegiy). Its id is a concordance.construct, a name that table keeps for history. A construct
is the concept that groups versions of one question across rewordings, administrations and,
in time, sources: a recorded, citable claim that these questions measure one thing. Nothing is
averaged; every question keeps its own rows.

SEED is the whole library. register() replaces the construct and construct_member tables
(migration 009) with it in one transaction, so a rerun changes nothing, and a construct taken
out of SEED leaves the store. A construct enters SEED only once it has been ruled on, and
each carries its anchor: the citation that makes the grouping the field's claim (a construct
without one says in its note whose judgment it is).

Member relations: core, the construct's flagship form (exactly one per construct); version,
a rewording or experiment; mode, the same text in another administration (the GSS web grid),
naming as parent the member it administers again. Members keep the order SEED gives them.

The fifteen harmonized GSS constructs, which fold several instruments' data under one id,
enter as constructs of one member each, relation core: the harmonized tier appears in the
layer without being restructured. Their construct id is their own id, as is the Congress
construct's, whose core is the harmonized confidence_congress.

The export serves the layer as index.json's families.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

from . import constructs, migrate
from .db import Store, connect

RELATIONS = ("core", "version", "mode")

MR133 = "MR133 (Cowan, Hout & Perrett 2021)"
MR133_URL = ("https://gss.norc.org/content/dam/gss/get-documentation/pdf/reports/"
             "methodological-reports/MR133%20Abortion.pdf")
CORE = "GSS replicating core"
NATIONAL_IDENTITY = "ISSP National Identity module, in the GSS"


@dataclass(frozen=True)
class Member:
    question: str
    relation: str
    parent: str | None = None


@dataclass(frozen=True)
class Anchor:
    """One item of a canonical trend list (audience/canonical.py) that a construct stands on."""
    list: str
    key: str
    item: str
    subject: str | None
    subtopic: str | None
    url: str


@dataclass(frozen=True)
class Construct:
    id: str
    label: str
    definition: str
    anchor: str | None
    note: str | None
    members: tuple[Member, ...]
    anchors: tuple[Anchor, ...] = ()


def _harmonized(cid: str, anchor: str, note: str) -> Construct:
    """A harmonized construct as its own sole member, labeled as constructs.py labels it."""
    label, definition = constructs.definition(cid)
    return Construct(cid, label, definition, anchor, note, (Member(cid, "core"),))


ROSSI_ITEMS = ("abdefect", "abnomore", "abhlth", "abpoor", "abrape", "absingle")

SEED: tuple[Construct, ...] = (
    Construct(
        "abortion_rossi", "Legal abortion: the Rossi conditions",
        "Whether it should be possible for a pregnant woman to obtain a legal abortion under "
        "each of six conditions: a strong chance of serious defect in the baby; married and "
        "wanting no more children; her own health seriously endangered; a family too poor for "
        "more children; pregnancy from rape; unmarried and not wanting to marry the man.",
        MR133,
        "MR133, p. 4: Alice Rossi wrote the six conditions, birth defects first, then the "
        "exceptions the American Law Institute was urging (the woman's health, rape) and three "
        "social ones (poor, single, no more children). Summed, they form the Rossi scale, 0 to "
        "6, still reliable fifty years on. The core is ABDEFECT, the first condition. The web "
        "grid forms (ABDEFECTG and its siblings, 2021-2024) put the same items to web "
        "respondents, \"Please indicate\" in place of \"Please tell me\"; each follows the item "
        "it repeats. ABANY, the condition the GSS added later, is its own construct, "
        f"abortion_any_reason. {MR133_URL}",
        tuple(m for item in ROSSI_ITEMS for m in (
            Member(item, "core" if item == "abdefect" else "version"),
            Member(f"{item}g", "mode", item)))),
    Construct(
        "abortion_any_reason", "Legal abortion for any reason",
        "Whether it should be possible for a pregnant woman to obtain a legal abortion if she "
        "wants it for any reason.",
        MR133,
        "MR133, p. 4: the GSS added \"for any reason\" (ABANY, asked from 1977) as a seventh "
        "condition after Rossi's six. As posed it is hard to interpret: 20 percent of people "
        "who disagreed with one or more of the six agreed with it, and the seven-item scale is "
        "less reliable than the six-item one (Hout and Hastings 2016). ABANYG puts it to web "
        "respondents (2021-2024). ABLEGAL, asked in 1977 alone, is a different question: "
        "should abortion be legal under any circumstances, only certain ones, or never, the "
        "form MR133's Appendix A prints as Gallup's. MR133 does not group it with ABANY; the "
        f"grouping is my ruling of 2026-10-26. {MR133_URL}",
        (Member("abany", "core"), Member("abanyg", "mode", "abany"),
         Member("ablegal", "version"))),
    Construct(
        "confidence_congress", *constructs.definition("confidence_congress"),
        f"{CORE}: the confidence battery",
        "The core is the harmonized CONLEGIS (1973-2024): a great deal, only some or hardly "
        "any confidence in the people running Congress. CONLEGIY puts the battery on a 1-7 "
        "scale from complete to no confidence, in 1984 alone. CONCONG, an ISSP item (1991, "
        "1998, 2008, 2018), asks how much confidence in the U.S. Congress on five points, "
        "without the people-running frame. TRLEGIS (2021) and TRCONG (2024) ask trust, not "
        "confidence, on 0-10: the furthest from the core, grouped on my ruling of 2026-10-26, "
        "not by any GSS concordance.",
        (Member("confidence_congress", "core"), Member("conlegiy", "version"),
         Member("concong", "version"), Member("trlegis", "version"),
         Member("trcong", "version"))),
    _harmonized(
        "party_id_7", CORE,
        "One member: GSS PARTYID, the same question since 1972. The harmonized entry also "
        "folds ANES VCF0301 (1952-2024) and CES pid7 (2020-2024) under its id, my "
        "harmonization."),
    _harmonized(
        "confidence_federal_executive", f"{CORE}: the confidence battery",
        "One member: GSS CONFED, 1973-2024."),
    _harmonized(
        "confidence_press", f"{CORE}: the confidence battery",
        "One member: GSS CONPRESS, 1973-2024."),
    _harmonized("social_trust", CORE, "One member: GSS TRUST, 1972-2024."),
    _harmonized("people_fair", CORE, "One member: GSS FAIR, 1972-2024."),
    _harmonized("people_helpful", CORE, "One member: GSS HELPFUL, 1972-2024."),
    _harmonized(
        "ideology_7", f"{CORE}; ANES time series",
        "One member: GSS POLVIEWS (1974-2024). The harmonized entry also folds ANES VCF0803 "
        "(1972-2024) under its id, my harmonization; ANES offers \"haven't thought much about "
        "this\" as an answer, the GSS does not."),
    _harmonized("get_ahead", CORE, "One member: GSS GETAHEAD, 1973-2024."),
    _harmonized("religious_attendance", CORE, "One member: GSS ATTEND, 1972-2024."),
    _harmonized(
        "gov_reduce_income_diff",
        f"{CORE} (EQWLTH); ISSP Role of Government and Social Inequality modules, in the GSS",
        "One member, which pools three GSS questions under one id, each its own item_text, my "
        "harmonization: EQWLTH, a 1-7 scale (1978-2024); EQUALIZE, a four-point should or "
        "should not (ISSP Role of Government); GOVEQINC, a five-point agree-disagree (ISSP "
        "Social Inequality)."),
    _harmonized(
        "income_gap_too_large", "GSS topical and ISSP modules",
        "One member: GSS INCGAP, asked in six years from 1987 to 2021."),
    _harmonized(
        "national_pride", NATIONAL_IDENTITY,
        "One member: GSS AMPROUD1, 2004 and 2014."),
    _harmonized(
        "national_pride_domain", NATIONAL_IDENTITY,
        "One member, which pools the ten PROUD* domains under one id, each its own item_text, "
        "my harmonization (1996, 2004, 2014, 2024)."),
    _harmonized(
        "nationalism", NATIONAL_IDENTITY,
        "One member, which pools AMCITIZN and AMBETTER under one id, each its own item_text, "
        "my harmonization (1996, 2004, 2014, 2024)."),
)


class SeedRejected(ValueError):
    """The seed breaks a rule of the layer; nothing was written."""


def validate(seed: tuple[Construct, ...], questions: set[str]) -> None:
    """Every rule register() enforces, checked before any write. questions: the ids in
    concordance."""
    ids = [c.id for c in seed]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        raise SeedRejected(f"construct ids repeated: {', '.join(dupes)}")
    items = [(a.list, a.key) for c in seed for a in c.anchors]
    twice = sorted({k for k in items if items.count(k) > 1})
    if twice:
        raise SeedRejected(f"a list item anchors two constructs: {twice[0][0]} {twice[0][1]}")
    for c in seed:
        where = f"construct {c.id!r}"
        if not c.label or not c.definition:
            raise SeedRejected(f"{where} lacks a label or definition")
        if not c.anchor and not c.note:
            raise SeedRejected(f"{where} has no anchor and no note saying whose judgment it is")
        if not c.members:
            raise SeedRejected(f"{where} has no members")
        names = [m.question for m in c.members]
        if len(set(names)) != len(names):
            raise SeedRejected(f"{where} lists a question twice")
        cores = [m.question for m in c.members if m.relation == "core"]
        if len(cores) != 1:
            raise SeedRejected(f"{where} has {len(cores)} core members; it needs exactly one")
        for m in c.members:
            if m.relation not in RELATIONS:
                raise SeedRejected(f"{where}: {m.question} has relation {m.relation!r}, "
                                   f"not one of {', '.join(RELATIONS)}")
            if m.question not in questions:
                raise SeedRejected(f"{where}: {m.question} is not a question in concordance")
            if m.relation == "mode":
                parent = next((p for p in c.members if p.question == m.parent), None)
                if parent is None or parent.relation == "mode":
                    raise SeedRejected(f"{where}: mode member {m.question} needs as parent "
                                       "a core or version member of the same construct")
            elif m.parent is not None:
                raise SeedRejected(f"{where}: only a mode member names a parent "
                                   f"({m.question} names {m.parent})")


def register(store: Store, seed: tuple[Construct, ...] = SEED) -> tuple[int, int]:
    """Replace the layer with seed. Returns (constructs, memberships) written."""
    questions = {r[0] for r in store.query("SELECT construct FROM concordance")}
    validate(seed, questions)
    members = [(c.id, m.question, m.relation, m.parent, i)
               for c in seed for i, m in enumerate(c.members, start=1)]
    anchored = store.table_exists("construct_anchor")
    if not anchored and any(c.anchors for c in seed):
        raise SeedRejected("the seed carries list anchors; apply migration 012 first")
    with store.transaction():
        if anchored:
            store.execute("DELETE FROM construct_anchor")
        store.execute("DELETE FROM construct_member")
        store.execute("DELETE FROM construct")
        for c in seed:
            store.execute(
                "INSERT INTO construct (construct_id, label, definition, anchor, note) "
                "VALUES (?, ?, ?, ?, ?)", [c.id, c.label, c.definition, c.anchor, c.note])
        for row in members:
            store.execute(
                "INSERT INTO construct_member "
                "(construct_id, question_id, relation, parent, ordinal) VALUES (?, ?, ?, ?, ?)",
                list(row))
        for c in seed:
            for i, a in enumerate(c.anchors, start=1):
                store.execute(
                    'INSERT INTO construct_anchor ("list", item_key, construct_id, item, subject, '
                    "subtopic, url, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [a.list, a.key, c.id, a.item, a.subject, a.subtopic, a.url, i])
    return len(seed), len(members)


REPORT = "construct_layer.json"
# A Guide chart's label match to an ANES question of exactly its years (see build).
SPAN_MATCH = 0.5
# Two list items' titles naming one concept across the lists (see build).
CROSS_LIST = 0.8


def main() -> int:
    import json

    from . import config

    store = connect()
    try:
        migrate.apply(store, quiet=True)
        library, report = build(store)
        n_constructs, n_members = register(store, library)
    finally:
        store.close()
    out = config.ROOT / "reports" / REPORT
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n")
    anchored = sum(1 for c in library if c.anchors)
    print(f"construct layer: {n_constructs} constructs ({anchored} on a list item), "
          f"{n_members} memberships; flags in {out}: "
          + ", ".join(f"{k} {len(v)}" for k, v in report.items()))
    return 0



# -- the canonical build -----------------------------------------------------------------
# The library past the ruled SEED: one construct per item of the field's own trend lists
# (audience/canonical.py), each anchored to its list. build() reads the lists and the store
# and returns the full set; main() registers it.

def normalized_wording(text: str) -> str:
    """A question's wording as the app's normalizeWording reads it for display
    (src/app/audience/audience-data.ts), lowercased: two questions whose normalized wordings
    are equal ask the same words."""
    import re

    t = re.sub(r"\[([^\]]*/[^\]]*)\]", lambda m: m.group(1).split("/")[-1].strip(), text)
    lead = re.match(r"^\s*\[([^\]]+)\]\s*(.+)$", t, re.S)
    if lead:
        head, rest = lead.group(1).strip(), lead.group(2)
        t = f"{head} {rest}" if re.search(r"[.?!]$", head) else f"{head} {rest[0].lower()}{rest[1:]}"
    stem = re.match(r"^\s*\(([^)]+)\)\s*(.+)$", t, re.S)
    if stem:
        t = re.sub(r"\s*(\.{3}|…|\.\s?\.\s?\.)\s*$", "", stem.group(1)).strip() + " " + stem.group(2).strip()
    elif t.lstrip().startswith("("):
        t = t.lstrip()[1:]
    t = re.sub(r"\s*\([^)]*(\.{3}|…)\s*\)\s*$", "", t)
    t = re.sub(r"\s+\d*\.?\s*(First|Second|Third) mention\.?$", "", t, flags=re.I)
    t = re.sub(r"\s*(?:\.\s?\.\s?\.|\.{3}|…)\s*([A-Za-z])", lambda m: " " + m.group(1).lower(), t)
    return re.sub(r"\s+", " ", t).strip().lower()


LIST_SHORT = {"GSS Key Trends": "GSS Key Trends",
              "ANES Guide to Public Opinion and Electoral Behavior": "ANES Guide"}
STOP = {"the", "and", "for", "are", "about", "with", "how", "you", "your", "what", "toward",
        "towards", "scale", "point", "respondent", "respondents", "should", "agree", "disagree",
        "think", "would", "does", "have", "has", "from", "that", "this", "than", "more", "less"}


def _key(text: str) -> str:
    import re

    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


def _words(text: str) -> set[str]:
    """A title's content words; its numbers count ("4 categories" is not "6 categories"), an
    edition's own numbering ("Religion (1)") does not."""
    import re

    text = re.sub(r"\(\d\)", " ", text.lower())
    return {w for w in re.findall(r"[a-z0-9]+", text)
            if (len(w) > 2 or w.isdigit()) and w not in STOP}


def similarity(a: str, b: str) -> float:
    """Shared content words over all content words of two titles (0 to 1)."""
    wa, wb = _words(a), _words(b)
    return len(wa & wb) / len(wa | wb) if wa and wb else 0.0


def match_table(title: str, tables: list[dict]) -> dict | None:
    """The previous edition's table a Guide chart reprints: the one whose title has the same
    words, or, failing that, the single closest one whose content words contain the chart's
    or are contained in them, at similarity 0.6 or more. None where that is not one table."""
    exact = [t for t in tables if _words(t["title"]) == _words(title)]
    if exact:
        return exact[0] if len(exact) == 1 else None
    a = _words(title)
    near = sorted(((similarity(title, t["title"]), t["id"], t) for t in tables
                   if (a <= _words(t["title"]) or _words(t["title"]) <= a)), reverse=True,
                  key=lambda x: (x[0], -x[1]))
    near = [x for x in near if x[0] >= 0.6]
    if not near or (len(near) > 1 and near[1][0] == near[0][0]):
        return None
    return near[0][2]


def _construct_id(anchor: "Anchor", taken: set[str]) -> str:
    import re

    base = re.sub(r"(_r\d*|_rec)$", "", anchor.key.lower()) if anchor.list == "GSS Key Trends" \
        else anchor.key.lower()
    cid, n = base, 2
    while cid in taken:
        cid, n = f"{base}_{n}", n + 1
    taken.add(cid)
    return cid


def _citation(anchors) -> str:
    return "; ".join(f"{LIST_SHORT[a.list]}: {a.item}" for a in anchors)


def build(store: Store, seed: tuple[Construct, ...] = SEED) -> tuple[tuple[Construct, ...], dict]:
    """The full library: seed, grown by every canonical list item the store can answer.

    Each item's variables map to question ids: the harmonized id where gss.ITEMS or anes.ITEMS
    folds the variable into one, else the variable lowercased; only questions with exported
    rows count. A GSS Key Trends item names its variables itself; an ANES Guide chart takes
    those of the previous edition's table of the same title. Items that share a question are
    one construct, and an item that shares a question with a seed construct joins it: the
    construct absorbs the anchor, never a second construct for one concept. A construct's
    core is its first item's first question, its other questions versions; a question whose
    normalized wording another question shares exactly comes in as a mode member beside it.
    A Guide chart with no table of its title takes the one ANES question that spans exactly
    the chart's years and whose label is nearest its title (similarity SPAN_MATCH or more, no
    tie): the publisher's own years and words agreeing. A construct anchored only in one list
    and one anchored only in the other whose titles share CROSS_LIST or more of their content
    words, each the other's only such partner, are one construct. Whatever the rules cannot
    settle is reported, never forced."""
    from collections import defaultdict

    from . import canonical
    from .loaders import anes, gss

    exported: dict[str, set[str]] = defaultdict(set)
    for source, cid in store.query(
            "SELECT DISTINCT source, construct FROM norms WHERE geography <> 'BLOCKGROUP'"):
        exported[source].add(cid)
    labels = dict(store.query("SELECT construct, label FROM concordance"))
    worded = store.column_exists("concordance", "gss_wording")
    wordings = dict(store.query(
        "SELECT construct, gss_wording FROM concordance WHERE gss_wording IS NOT NULL")) \
        if worded else {}
    spans = {cid: (lo, hi) for cid, lo, hi in store.query(
        "SELECT construct, min(year(period_end)), max(year(period_end)) FROM norms "
        "WHERE source = 'ANES' GROUP BY construct")}
    gss_ids = {i.var.lower(): i.construct for i in gss.ITEMS}
    anes_ids = {i.var.upper(): i.construct for i in anes.ITEMS}
    report: dict = {"not_in_store": [], "guide_unmatched": [], "guide_by_span": [],
                    "merged_across_lists": [], "same_concept": [],
                    "ces_attached": [], "ces": [], "wording_elsewhere": []}

    # Each list item, its anchor and the questions it names.
    items: list[dict] = []
    trends = canonical.key_trends()
    # A record may name, after its own variable, another item's variable it recodes with
    # (relig_rec reads fund to split Protestants): that one stays the other item's.
    own = {it["variables"][0] for it in trends}
    for it in trends:
        variables = it["variables"][:1] + [v for v in it["variables"][1:] if v not in own]
        members = list(dict.fromkeys(
            q for q in (gss_ids.get(v, v) for v in variables) if q in exported["GSS"]))
        items.append({"anchor": Anchor(it["list"], it["key"], it["item"], it["subject"],
                                       it["subtopic"], it["url"]),
                      "variables": variables, "members": members, "question": None})
    tables = [t for t in canonical.guide_tables() if t["variables"]]
    for it in canonical.guide_items():
        anchor = Anchor(it["list"], it["key"], it["item"], it["subject"], it["subtopic"], it["url"])
        t = match_table(it["item"], tables)
        if t is None:
            near = sorted(((similarity(it["item"], labels.get(q, q)), q) for q in exported["ANES"]
                           if q in spans and spans[q][0] == it["years"][0]), reverse=True)[:3]
            exact = [(sim, q) for sim, q in near if spans[q] == tuple(it["years"])]
            if exact and exact[0][0] >= SPAN_MATCH and (len(exact) == 1 or exact[1][0] < exact[0][0]):
                sim, q = exact[0]
                report["guide_by_span"].append({
                    "item": it["item"], "years": list(it["years"]), "url": it["url"],
                    "question": q, "label": labels.get(q), "similarity": round(sim, 2)})
                items.append({"anchor": anchor, "variables": [q.upper()], "members": [q],
                              "question": None, "table": None})
                continue
            report["guide_unmatched"].append({
                "item": it["item"], "years": list(it["years"]), "url": it["url"],
                "candidates": [{"question": q, "label": labels.get(q), "span": list(spans[q]),
                                "similarity": round(sim, 2)} for sim, q in near if sim > 0]})
            continue
        members = list(dict.fromkeys(
            q for q in (anes_ids.get(v, v.lower()) for v in t["variables"]) if q in exported["ANES"]))
        items.append({"anchor": anchor, "variables": t["variables"], "members": members,
                      "question": t["question"], "table": t["table"]})
    for it in items:
        if not it["members"]:
            report["not_in_store"].append({"list": LIST_SHORT[it["anchor"].list],
                                           "item": it["anchor"].item, "variables": it["variables"]})
    items = [it for it in items if it["members"]]

    # Items that share a question are one construct; a seed construct's questions pull its
    # items in.
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        parent[find(a)] = find(b)

    for c in seed:
        for m in c.members:
            union(f"q:{m.question}", f"s:{c.id}")
    for n, it in enumerate(items):
        for q in it["members"]:
            union(f"i:{n}", f"q:{q}")
    groups: dict[str, list[int]] = defaultdict(list)
    for n in range(len(items)):
        groups[find(f"i:{n}")].append(n)
    seed_root = {find(f"s:{c.id}"): c for c in seed}
    order = {canonical.KEY_TRENDS_LIST: 0, canonical.GUIDE_LIST: 1}

    taken = {c.id for c in seed}
    out: list[Construct] = []
    absorbed: set[str] = set()
    for root, ns in groups.items():
        its = sorted((items[n] for n in ns), key=lambda it: order[it["anchor"].list])
        anchors = tuple(it["anchor"] for it in its)
        family = seed_root.get(root)
        if family is not None:
            absorbed.add(family.id)
            have = [m.question for m in family.members]
            extra = [Member(q, "version") for it in its for q in it["members"] if q not in have]
            out.append(Construct(
                family.id, family.label, family.definition,
                "; ".join(x for x in (family.anchor, _citation(anchors)) if x),
                family.note, family.members + tuple(dict.fromkeys(extra)), anchors))
            continue
        questions = list(dict.fromkeys(q for it in its for q in it["members"]))
        first = its[0]
        definition = wordings.get(questions[0]) or first.get("question") or first["anchor"].item
        out.append(Construct(
            _construct_id(first["anchor"], taken), first["anchor"].item, definition,
            _citation(anchors), None,
            (Member(questions[0], "core"),) + tuple(Member(q, "version") for q in questions[1:]),
            anchors))
    out += [c for c in seed if c.id not in absorbed]
    out.sort(key=lambda c: c.id)

    # One concept, two lists: a construct anchored only in Key Trends and one anchored only in
    # the Guide, titled alike, each the other's only such partner, are one construct.
    single = {c.id: next(iter({a.list for a in c.anchors})) for c in out
              if c.anchors and len({a.list for a in c.anchors}) == 1 and c.id not in absorbed}
    pairs = [(g, a) for g in out if single.get(g.id) == canonical.KEY_TRENDS_LIST
             for a in out if single.get(a.id) == canonical.GUIDE_LIST
             and similarity(g.label, a.label) >= CROSS_LIST]
    partners = defaultdict(int)
    for g, a in pairs:
        partners[g.id] += 1
        partners[a.id] += 1
    gone = set()
    merged = {}
    for g, a in pairs:
        if partners[g.id] > 1 or partners[a.id] > 1:
            continue
        merged[g.id] = Construct(
            g.id, g.label, g.definition, _citation(g.anchors + a.anchors), None,
            g.members + tuple(Member(m.question, "version") for m in a.members
                              if m.question not in {x.question for x in g.members}),
            g.anchors + a.anchors)
        gone.add(a.id)
        report["merged_across_lists"].append({
            "construct": g.id, "gss_item": g.label, "anes_item": a.label, "anes_construct": a.id,
            "similarity": round(similarity(g.label, a.label), 2)})
    out = [merged.get(c.id, c) for c in out if c.id not in gone]

    # Exact-wording twins: a question asking the same words as a member joins beside it.
    groups_w: dict[str, list[str]] = defaultdict(list)
    for q, w in sorted(wordings.items()):
        if q in exported["GSS"]:
            groups_w[normalized_wording(w)].append(q)
    twin = {q: g for g in groups_w.values() if len(g) > 1 for q in g}
    home = {m.question: c.id for c in out for m in c.members}
    grown = []
    for c in out:
        extra = []
        for m in c.members:
            if m.relation == "mode":
                continue
            for q in twin.get(m.question, ()):
                if q == m.question or home.get(q) == c.id:
                    continue
                if q in home:
                    report["wording_elsewhere"].append(
                        {"question": q, "twin": m.question, "construct": home[q], "beside": c.id})
                    continue
                extra.append(Member(q, "mode", m.question))
                home[q] = c.id
        grown.append(Construct(c.id, c.label, c.definition, c.anchor, c.note,
                               c.members + tuple(extra), c.anchors) if extra else c)
    out = grown

    # A CES question whose label has exactly the words of one construct's label, or of one of
    # its questions' labels, joins it as a version; a nearer-than-not one is only reported.
    def label_words(c: Construct) -> list[set[str]]:
        return [_words(c.label)] + [_words(labels.get(m.question, "")) for m in c.members]

    claims: dict[str, list[str]] = defaultdict(list)
    for q in sorted(exported["CES"] - set(home)):
        w = _words(labels.get(q, ""))
        if not w:
            continue
        for c in out:
            if any(w == lw for lw in label_words(c)):
                claims[q].append(c.id)
    joins: dict[str, list[str]] = defaultdict(list)
    for q, cids in claims.items():
        if len(cids) == 1:
            joins[cids[0]].append(q)
            home[q] = cids[0]
            report["ces_attached"].append({"question": q, "label": labels.get(q), "construct": cids[0]})
        else:
            report["ces"].append({"question": q, "label": labels.get(q), "constructs": cids,
                                  "why": "its label matches more than one construct"})
    out = [Construct(c.id, c.label, c.definition, c.anchor, c.note,
                     c.members + tuple(Member(q, "version") for q in joins[c.id]), c.anchors)
           if joins.get(c.id) else c for c in out]

    # For the lead: concepts the two lists may share without sharing a question, and CES
    # questions that read like a construct. Neither is merged or attached.
    by_list = defaultdict(list)
    for c in out:
        lists = {a.list for a in c.anchors}
        if len(lists) == 1:
            by_list[next(iter(lists))].append(c)
    for g in by_list.get(canonical.KEY_TRENDS_LIST, []):
        for a in by_list.get(canonical.GUIDE_LIST, []):
            s = similarity(g.label, a.label)
            if s >= 0.5:
                report["same_concept"].append({"gss": g.id, "gss_item": g.label, "anes": a.id,
                                               "anes_item": a.label, "similarity": round(s, 2)})
    for c in out:
        best = sorted(((similarity(c.label, labels.get(q, q)), q) for q in exported["CES"]
                       if q not in home), reverse=True)[:2]
        for s, q in best:
            if s >= 0.5:
                report["ces"].append({"question": q, "label": labels.get(q), "constructs": [c.id],
                                      "why": f"label near {c.label!r} ({s:.2f})"})
    report["same_concept"].sort(key=lambda x: -x["similarity"])
    report["ces"].sort(key=lambda x: (x["constructs"], x["question"]))
    return tuple(out), report


if __name__ == "__main__":
    sys.exit(main())
