-- The construct layer. A question is one asked instrument: one wording, one administration,
-- one id (abany, abanyg, conlegiy). Its id is a concordance.construct, a name that table
-- keeps for history: its raw-tier entries are questions, one each. A construct is the concept
-- that groups versions of one question across rewordings, administrations and sources: a
-- recorded, citable claim that these questions measure one thing. Nothing is averaged; every
-- question keeps its own rows. audience/construct_layer.py writes both tables from its seed,
-- and the export serves them as index.json's families.
--
-- anchor is the citation that makes a grouping the field's claim ("GSS replicating core",
-- "MR133 (Cowan, Hout & Perrett 2021)"); a construct without one says in note whose
-- judgment it is.
--
-- relation is core (the construct's flagship form), version (a rewording or experiment) or
-- mode (the same text in another administration, such as the GSS web grid). parent names the
-- member a mode member administers again; ordinal is the member's place in the construct's
-- list. The relation vocabulary and question_id are checked by construct_layer.py and the
-- audit, not here: the vocabulary grows by ruling, and DuckDB cannot alter a CHECK.

CREATE TABLE IF NOT EXISTS construct (
  construct_id  text PRIMARY KEY,
  label         text NOT NULL,
  definition    text NOT NULL,
  anchor        text,
  note          text,
  CHECK (anchor IS NOT NULL OR note IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS construct_member (
  construct_id  text NOT NULL,
  question_id   text NOT NULL,
  relation      text NOT NULL,
  parent        text,
  ordinal       integer NOT NULL,
  PRIMARY KEY (construct_id, question_id)
);
