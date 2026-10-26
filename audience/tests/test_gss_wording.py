"""GSS question wordings: the cleaner on Data Explorer entries quoted verbatim, the abortion
battery against GSS Methodological Report 133, the six /audience slice questions, coverage
over the cached variable list, and the store-to-export path."""

import json
import re

import pytest

from audience import export, geographies
from audience.loaders import gss, gss_wording as gw
from conftest import make_row

# Data Explorer surveyQuestion entries, verbatim (raw/gss/data_explorer_variables.json).
CONLEGIS = ("I am going to name some institutions in this country. As far as the people running "
            "these institutions are concerned, would you say you have a great deal of "
            "confidence, only some confidence, or hardly any confidence at all in them?  \n"
            "READ EACH ITEM; CODE ONE FOR EACH.\nL. Congress")
ABANY = ("Please tell me whether or not you think it should be possible for a pregnant woman to "
         "obtain a legal abortion if. . .READ EACH STATEMENT, AND CIRCLE ONE CODE FOR EACH. \n"
         "G. The woman wants it for any reason?")


def test_a_battery_item_reads_as_its_stem_joined_to_its_item():
    assert gw.clean(CONLEGIS) == dict((i.var, i.text) for i in gss.ITEMS)["conlegis"]
    assert gw.clean(ABANY) == (
        "Please tell me whether or not you think it should be possible for a pregnant woman to "
        "obtain a legal abortion if. . . The woman wants it for any reason?")


def test_encoding_damage_is_repaired_from_position():
    # UTF-8 read as cp1252, including a byte cp1252 leaves undefined (the closing quote's \x9d)
    assert gw.clean("Now, Iâ€™m going to ask some questions") == "Now, I’m going to ask some questions"
    assert gw.clean("ASK IN TERMS OF â€œHIGH SCHOOL.â€\x9d \nB. Besides Whites?") == "Besides Whites?"
    # a character the list lost: apostrophe in a word, quotes round a phrase, else an ellipsis
    assert gw.clean("Why doesnï¿½t your family have a pet?") == "Why doesn’t your family have a pet?"
    assert gw.clean("where 0 means ï¿½No trust at allï¿½ and 10") == "where 0 means “No trust at all” and 10"
    assert gw.clean("would you give if you were ableï¿½Help paying for the abortion?") == (
        "would you give if you were able…Help paying for the abortion?")
    assert gw.clean("If the woman''s own health is seriously endangered?") == (
        "If the woman's own health is seriously endangered?")


def test_directives_go_whole_and_fills_stay():
    judge = ("When you think about God, how likely are each of these images to come to your mind?  "
             "Would you say extremely likely, somewhat likely, not too likely, or not likely at "
             "all? (HAND CARD AD. READ EACH ITEM.) (CIRCLE ONE NUMBER FOR EACH WORD)\nA. Judge")
    assert gw.clean(judge).endswith("or not likely at all? Judge")
    assert gw.clean("Here in [CURRENT STATE], how easy or hard is it?") == "Here in [CURRENT STATE], how easy or hard is it?"
    assert gw.clean("since (CURRENT MONTH), (1990/2003). \nD. Did any occur?") == "since (CURRENT MONTH), (1990/2003). Did any occur?"
    assert gw.clean("Code sex. [ASK IF NOT OBVIOUS].\nC. How old was [HEAD/PERSON]?") == "Code sex. How old was [HEAD/PERSON]?"
    assert gw.clean("Do you vote?\n1. IF VOTED:  Did you vote for Obama or McCain?") == "Do you vote? Did you vote for Obama or McCain?"
    assert gw.clean("A member of each type?  READ EACH ITEM. CODE OnE FOR EACH.\nO. Church groups [See REMARKS]") == (
        "A member of each type? Church groups")
    # a directive word inside a parenthesis that is not a directive leaves it whole
    school = ("What is the name of the head of the local school system? (CORRECT ANSWERS INCLUDE "
              "THE NAME OF THE SUPERINTENDENT OF SCHOOLS).")
    assert gw.clean(school) == "What is the name of the head of the local school system?"
    # a capitals run that trails into lowercase without a sentence end stays
    assert gw.clean("Just tell me. If LESS THAN 5 NAMES MENTIONED, PROBE, Anyone else?") == (
        "Just tell me. If LESS THAN 5 NAMES MENTIONED, PROBE, Anyone else?")


def test_notes_headers_and_derived_variables_carry_no_wording():
    assert gw.clean("How masculine do you see yourself\n\nNOTE: This variable originates on the "
                    "GSS Next follow-on, and should not be analyzed without the weights") == (
        "How masculine do you see yourself")
    assert gw.clean("How many sex partners have you had in the last 12 months? As of 2024, "
                    "PARTNERS has been recoded to only account for 0 to 11+ partners.") == (
        "How many sex partners have you had in the last 12 months?")
    assert gw.clean("RESPONDENT'S DEGREE") is None
    assert gw.clean("Calculated variable: Total adults in household according to roster") is None
    assert gw.clean("Constructed from variables AGE, YEARSUSA, and MNTHSUSA") is None
    assert gw.clean("") is None and gw.clean(None) is None


def test_a_construct_pooling_several_questions_has_none(tmp_path):
    found, detail = gw.wordings({"nationalism": ["amcitizn", "ambetter"], "abany": ["abany"],
                                 "degree": ["degree"]},
                                {"amcitizn": "x?", "ambetter": "y?", "abany": ABANY,
                                 "degree": "RESPONDENT'S DEGREE"})
    assert set(found) == {"abany"} and detail["nationalism"]["wording"] is None
    gw.write_report(detail, tmp_path / "gss_wording.json")
    report = json.loads((tmp_path / "gss_wording.json").read_text())
    assert report["worded"] == 1 and report["worded_from"] == {"explorer": 1, "codebook": 0}
    assert report["missing"] == {"a header or label in capitals, not a question": ["degree"],
                                 "pools 2 GSS questions, so no one wording": ["nationalism"]}


def test_store_to_export(store, tmp_path):
    store.upsert_concordance({"construct": "sex", "label": "Sex", "definition": "Sex"})
    store.upsert_concordance({"construct": "abany", "label": "Abortion if woman wants for any "
                              "reason", "definition": "Abortion if woman wants for any reason"})
    store.upsert_norms([make_row(), make_row(construct="abany", source="GSS",
                                              source_version="GSS fixture", geography="US",
                                              geo_code="US", estimate_type="pct",
                                              response_option="Yes", estimate=60.0)])
    written = gw.write(store, {"abany": gw.clean(ABANY)}, ["abany"])
    assert written == 1
    geographies.refresh(store, quiet=True)
    index = export.export(store, tmp_path / "audience-data")
    by = {c["construct"]: c for c in index["constructs"]}
    assert by["abany"]["wording"].endswith("The woman wants it for any reason?")
    assert set(by["sex"]) == {"construct", "label", "definition"}   # no key, not null
    gw.write(store, {}, ["abany"])                                   # a rerun clears it
    assert store.query("SELECT gss_wording FROM concordance WHERE construct = 'abany'") == [(None,)]


# -- the cached Data Explorer list -----------------------------------------------------------

@pytest.fixture(scope="module")
def texts():
    t = gw.explorer_texts()
    if not t:
        pytest.skip("Data Explorer variable list not under raw/gss/ (python -m audience.load gss)")
    return t


def words(s):
    """Compared as words: case, curly marks, ellipses and spacing aside."""
    s = s.replace("’", "'").replace("…", "...").lower()
    return re.findall(r"[a-z0-9']+", s)


# GSS Methodological Report 133 (Cowan, Hout and Perrett 2021), Appendix A, p. 46, and the
# 2018 module, p. 10:
# https://gss.norc.org/content/dam/gss/get-documentation/pdf/reports/methodological-reports/MR133%20Abortion.pdf
ROSSI = ("Please tell me whether or not you think it should be possible for a pregnant woman to "
         "obtain a legal abortion if...")
MR133 = {
    "abdefect": f"{ROSSI} If there is a strong chance of serious defect in the baby?",
    "abnomore": f"{ROSSI} If she is married and does not want any more children?",
    "abhlth": f"{ROSSI} If the woman’s own health is seriously endangered by the pregnancy?",
    "abpoor": f"{ROSSI} If the family has a very low income and cannot afford any more children?",
    "abrape": f"{ROSSI} If she became pregnant as a result of rape?",
    "absingle": f"{ROSSI} If she is not married and does not want to marry the man?",
    "abany": f"{ROSSI} The woman wants it for any reason?",
    "abfelegl": ("Leaving aside what you think of abortion for yourself, do you think a woman "
                 "should continue to be able to have an abortion legally or not, or would you say "
                 "it depends?"),
    "abmelegl": ("Leaving aside what you think of abortion for those close to you, do you think a "
                 "woman should continue to be able to have an abortion legally or not, or would "
                 "you say it depends?"),
    "abstate1": ("Here in [current state], how easy or hard do you think it is for a woman to get "
                 "an abortion?"),
    "abstate2": ("Here in [current state], do you think that laws should be changed to make it "
                 "easier for a woman to get an abortion, be changed to make it harder for a woman "
                 "to get an abortion, or should the laws stay as they are now?"),
    "abhelp1": ("If a close family member or friend decided to have an abortion, which of the "
                "following kinds of help, if any, would you give if you were able... Help with "
                "arrangements, like a ride or childcare?"),
    "abhelp2": ("If a close family member or friend decided to have an abortion, which of the "
                "following kinds of help, if any, would you give if you were able... Help paying "
                "for the abortion?"),
    "abhelp3": ("If a close family member or friend decided to have an abortion, which of the "
                "following kinds of help, if any, would you give if you were able... Help paying "
                "for costs other than the abortion, like for a ride or hotel if she needs to stay "
                "overnight?"),
    "abhelp4": ("If a close family member or friend decided to have an abortion, which of the "
                "following kinds of help, if any, would you give if you were able... Help by "
                "providing emotional support?"),
    "abinspay": ("People use their health insurance to help cover the cost of receiving health "
                 "care. Do you think people should be able to use their health insurance to help "
                 "cover the cost of receiving an abortion?"),
}


@pytest.mark.parametrize("var", sorted(MR133))
def test_abortion_battery_matches_mr133(texts, var):
    assert words(gw.clean(texts[var])) == words(MR133[var])


def test_abmoral_follows_the_codebook_where_mr133_shortens_it(texts):
    # MR133 p. 10 prints "Leaving aside whether you think"; the Explorer and the printed 2024
    # codebook (R3a, ABMORAL) both read "whether or not you think".
    assert gw.clean(texts["abmoral"]) == (
        "Leaving aside whether or not you think abortion should be legal, are you morally "
        "opposed to abortion or not, or would you say it depends?")


SLICE = {
    "confidence_congress": ["conlegis"],
    "concong": ["concong"],
    "conlegiy": ["conlegiy"],
    "trcong": ["trcong"],
    "trlegis": ["trlegis"],
    "party_id_7": ["partyid"],
}


def test_the_slice_questions(texts):
    found, _ = gw.wordings(SLICE, texts)
    assert found["confidence_congress"].endswith("hardly any confidence at all in them? Congress")
    assert found["party_id_7"] == ("Generally speaking, do you usually think of yourself as a "
                                   "Republican, Democrat, Independent, or what?")
    assert found["concong"] == "How much confidence do you have in. . . U.S. Congress"
    assert found["conlegiy"].endswith("Where would you place yourself on this scale for . . . Congress")
    assert found["trcong"].endswith("you trust it completely….The U.S. Congress.")
    assert found["trlegis"] == "How much do you trust the U.S. Congress?"


def test_harmonized_wordings_agree_with_the_loaders_own(texts):
    """gss.ITEMS was transcribed from the printed codebooks; the Explorer is an independent
    route to the same text. NATIONAL_PRIDE's web form adds its on-screen instruction."""
    for item in gss.ITEMS:
        if sum(i.construct == item.construct for i in gss.ITEMS) > 1:
            continue
        got = gw.clean(texts[item.var])
        if item.var == "amproud1":
            assert got == f"{item.text} (Please, select one response)"
        else:
            assert words(got) == words(item.text), item.var


def test_the_printed_codebook_fills_what_the_explorer_lacks(texts):
    assert not texts["class_"] and not texts["union_"]
    found, detail = gw.wordings({"class": ["class"], "union": ["union"],
                                 "racdif1x": ["racdif1x"]}, texts)
    assert found["class"].startswith("If you were asked to use one of four names for your social")
    assert found["union"] == "Do you (or your [SPOUSE]) belong to a labor union? (Who?)"
    assert {detail[c]["source"] for c in ("class", "union")} == {"codebook"}
    assert "racdif1x" not in found   # the 2024 codebook cuts its label off mid-item


def test_coverage_of_the_variable_list(texts):
    worded = sum(1 for v in texts.values() if gw.clean(v))
    assert worded >= 6_800
    assert sum(1 for v in texts.values() if v and gw.clean(v) is None) < 150
