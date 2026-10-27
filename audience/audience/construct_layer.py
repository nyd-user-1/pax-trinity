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
class Construct:
    id: str
    label: str
    definition: str
    anchor: str | None
    note: str | None
    members: tuple[Member, ...]


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
    with store.transaction():
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
    return len(seed), len(members)


def main() -> int:
    store = connect()
    try:
        migrate.apply(store, quiet=True)
        n_constructs, n_members = register(store)
    finally:
        store.close()
    print(f"construct layer: {n_constructs} constructs, {n_members} memberships")
    return 0


if __name__ == "__main__":
    sys.exit(main())
