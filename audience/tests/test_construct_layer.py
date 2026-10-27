"""The construct layer: the seed's rulings, the rules register() enforces, and the export's
families array."""

import datetime as dt
import json

import pytest

from audience import audit, construct_layer as cl, export, geographies
from audience.construct_layer import Construct, Member, SeedRejected

QUESTIONS = {m.question for c in cl.SEED for m in c.members}
BY_ID = {c.id: c for c in cl.SEED}
HARMONIZED_GSS = {
    "confidence_federal_executive", "confidence_congress", "confidence_press", "social_trust",
    "people_fair", "people_helpful", "ideology_7", "party_id_7", "national_pride",
    "national_pride_domain", "nationalism", "get_ahead", "gov_reduce_income_diff",
    "income_gap_too_large", "religious_attendance"}


def relations(cid):
    return [(m.question, m.relation, m.parent) for m in BY_ID[cid].members]


def test_the_seed_keeps_its_own_rules():
    cl.validate(cl.SEED, QUESTIONS)
    assert len(cl.SEED) == 17
    assert all(c.anchor for c in cl.SEED)


def test_the_rossi_battery_in_mr133_order_with_each_web_twin_beside_its_item():
    assert relations("abortion_rossi") == [
        ("abdefect", "core", None), ("abdefectg", "mode", "abdefect"),
        ("abnomore", "version", None), ("abnomoreg", "mode", "abnomore"),
        ("abhlth", "version", None), ("abhlthg", "mode", "abhlth"),
        ("abpoor", "version", None), ("abpoorg", "mode", "abpoor"),
        ("abrape", "version", None), ("abrapeg", "mode", "abrape"),
        ("absingle", "version", None), ("absingleg", "mode", "absingle")]
    assert BY_ID["abortion_rossi"].anchor == cl.MR133


def test_abany_sits_in_one_construct_as_its_core():
    homes = [(c.id, m.relation) for c in cl.SEED for m in c.members if m.question == "abany"]
    assert homes == [("abortion_any_reason", "core")]
    assert relations("abortion_any_reason") == [
        ("abany", "core", None), ("abanyg", "mode", "abany"), ("ablegal", "version", None)]
    note = BY_ID["abortion_any_reason"].note
    assert "20 percent" in note and "less reliable" in note   # MR133's ABANY caveat


def test_congress_forms_and_the_harmonized_tier():
    assert relations("confidence_congress") == [
        ("confidence_congress", "core", None), ("conlegiy", "version", None),
        ("concong", "version", None), ("trlegis", "version", None), ("trcong", "version", None)]
    assert "trust, not confidence" in BY_ID["confidence_congress"].note
    alone = {c.id for c in cl.SEED if len(c.members) == 1}
    assert alone == HARMONIZED_GSS - {"confidence_congress"}
    assert all(relations(cid) == [(cid, "core", None)] for cid in alone)
    assert BY_ID["party_id_7"].anchor == "GSS replicating core"


def test_no_question_belongs_to_two_constructs():
    seen = [m.question for c in cl.SEED for m in c.members]
    assert len(seen) == len(set(seen))


def one(*members, anchor="A", note=None, cid="x"):
    return (Construct(cid, "Label", "Definition", anchor, note, tuple(members)),)


@pytest.mark.parametrize("seed, message", [
    (one(Member("q1", "core"), anchor=None), "no anchor and no note"),
    (one(Member("q1", "version")), "0 core members"),
    (one(Member("q1", "core"), Member("q2", "core")), "2 core members"),
    (one(Member("q1", "core"), Member("q2", "item")), "relation 'item'"),
    (one(Member("q1", "core"), Member("nope", "version")), "not a question"),
    (one(Member("q1", "core"), Member("q2", "mode")), "needs as parent"),
    (one(Member("q1", "core"), Member("q2", "mode", "q3")), "needs as parent"),
    (one(Member("q1", "core"), Member("q2", "version", "q1")), "only a mode member"),
    (one(Member("q1", "core"), Member("q1", "version")), "lists a question twice"),
    (one(Member("q1", "core")) + one(Member("q2", "core")), "repeated"),
])
def test_validate_refuses(seed, message):
    with pytest.raises(SeedRejected, match=message):
        cl.validate(seed, {"q1", "q2", "q3"})


def test_an_anchorless_construct_with_a_note_passes():
    cl.validate(one(Member("q1", "core"), anchor=None, note="My judgment."), {"q1"})


def seeded(store, with_rows=QUESTIONS):
    for q in sorted(QUESTIONS):
        store.upsert_concordance({"construct": q, "label": q, "definition": q})
    store.upsert_norms(
        dict(source="GSS", source_version="test", geography="US", geo_code="US",
             period_start=dt.date(2024, 1, 1), period_end=dt.date(2024, 12, 31), construct=q,
             item_text=None, response_option="Yes", subgroup_dim="all", subgroup_value="all",
             estimate=50.0, estimate_type="pct", provenance_url="https://gss.norc.org")
        for q in sorted(with_rows))
    geographies.refresh(store, quiet=True)


def test_register_replaces_the_layer_and_a_rerun_changes_nothing(store):
    seeded(store)
    assert cl.register(store) == (17, 34)
    assert cl.register(store) == (17, 34)
    assert store.query("SELECT count(*) FROM construct")[0][0] == 17
    rows = store.query("SELECT question_id, relation, parent, ordinal FROM construct_member "
                       "WHERE construct_id = 'abortion_any_reason' ORDER BY ordinal")
    assert rows == [("abany", "core", None, 1), ("abanyg", "mode", "abany", 2),
                    ("ablegal", "version", None, 3)]
    cl.register(store, cl.SEED[:2])
    assert store.query("SELECT count(*) FROM construct")[0][0] == 2


def test_a_rejected_seed_writes_nothing(store):
    seeded(store)
    cl.register(store)
    with pytest.raises(SeedRejected):
        cl.register(store, one(Member("not_a_question", "core")))
    assert store.query("SELECT count(*) FROM construct_member")[0][0] == 34


def test_the_export_serves_families_after_everything_else(store, tmp_path):
    seeded(store)
    bare = export.export(store, tmp_path / "bare")
    assert "families" not in bare                      # an empty layer adds no key
    cl.register(store)
    index = export.export(store, tmp_path / "out")
    assert list(index) == ["sources", "constructs", "geographies", "families"]
    assert {k: v for k, v in index.items() if k != "families"} == bare
    families = {f["id"]: f for f in index["families"]}
    assert len(families) == 17
    assert all(set(f) <= {"id", "label", "definition", "anchor", "note", "members"}
               and {"id", "label", "definition", "anchor", "members"} <= set(f)
               for f in families.values())
    assert families["abortion_any_reason"]["members"] == [
        {"question": "abany", "relation": "core"},
        {"question": "abanyg", "relation": "mode", "of": "abany"},
        {"question": "ablegal", "relation": "version"}]
    assert len(families["abortion_rossi"]["members"]) == 12
    assert families["party_id_7"]["members"] == [{"question": "party_id_7", "relation": "core"}]
    named = {c["construct"] for c in index["constructs"]}
    assert all(m["question"] in named for f in families.values() for m in f["members"])
    on_disk = json.loads((tmp_path / "out" / "index.json").read_text())
    assert on_disk["families"] == index["families"]


def test_the_export_leaves_out_members_without_rows(store, tmp_path):
    seeded(store, with_rows=QUESTIONS - {"ablegal", "trcong", "trlegis", "conlegiy",
                                         "concong", "confidence_congress"})
    cl.register(store)
    families = {f["id"]: f for f in export.export(store, tmp_path)["families"]}
    assert [m["question"] for m in families["abortion_any_reason"]["members"]] == [
        "abany", "abanyg"]
    assert "confidence_congress" not in families


def test_the_audit_names_a_member_that_is_no_question(store, capsys):
    seeded(store)
    cl.register(store)
    assert audit.run(store) == 0
    store.execute("INSERT INTO construct_member VALUES ('party_id_7', 'ghost', 'version', NULL, 2)")
    store.execute("UPDATE construct_member SET relation = 'item' WHERE question_id = 'abrape'")
    assert audit.run(store) == 1
    out = capsys.readouterr().out
    assert "party_id_7/ghost (no concordance row)" in out
    assert "abortion_rossi/abrape (relation item)" in out
