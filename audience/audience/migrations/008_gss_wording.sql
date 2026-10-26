-- The verbatim GSS question text of a construct, from the Data Explorer's variable list
-- (audience/loaders/gss_wording.py writes it). The export serves it as the constructs entry's
-- optional wording; a construct without one keeps its label and definition alone.

ALTER TABLE concordance ADD COLUMN IF NOT EXISTS gss_wording text;
