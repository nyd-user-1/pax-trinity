-- Core schema. ${TEXT_ARRAY} and ${NUMERIC} are filled per backend by audience/migrate.py:
-- Postgres gets text[] and numeric; DuckDB gets JSON and DECIMAL(38,10).

CREATE TABLE IF NOT EXISTS concordance (
  construct   text PRIMARY KEY,
  label       text NOT NULL,
  definition  text NOT NULL,
  anes_var    ${TEXT_ARRAY},
  gss_var     ${TEXT_ARRAY},
  ces_var     ${TEXT_ARRAY},
  wvs_var     ${TEXT_ARRAY},
  acs_table   text,
  cps_var     text,
  notes       text
);

CREATE TABLE IF NOT EXISTS sources (
  source       text PRIMARY KEY,
  name         text NOT NULL,
  url          text NOT NULL,
  license      text NOT NULL,
  access_notes text,
  last_loaded  timestamptz
);

-- natural_key is the sha256 the loaders upsert on (audience/db.py natural_key()).
-- norm_id is uuid5(natural_key), so a row keeps its id across reruns.
-- construct references concordance.construct; db.upsert_norms refuses unknown constructs
-- and the audit re-checks, in place of a DB-level foreign key.
CREATE TABLE IF NOT EXISTS norms (
  norm_id          uuid PRIMARY KEY,
  natural_key      text NOT NULL UNIQUE,
  source           text NOT NULL,
  source_version   text NOT NULL,
  geography        text NOT NULL,
  geo_code         text NOT NULL,
  period_start     date NOT NULL,
  period_end       date NOT NULL,
  construct        text NOT NULL,
  item_text        text,
  response_option  text,
  subgroup_dim     text NOT NULL,
  subgroup_value   text NOT NULL,
  estimate         ${NUMERIC},
  estimate_type    text NOT NULL,
  n                integer,
  se               ${NUMERIC},
  moe              ${NUMERIC},
  weight_var       text,
  provenance_url   text NOT NULL CHECK (provenance_url <> ''),
  provenance_note  text,
  extracted_at     timestamptz NOT NULL
);
