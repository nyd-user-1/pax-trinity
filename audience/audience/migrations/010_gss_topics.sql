-- The GSS Data Explorer's subjects for a construct's question, verbatim and in the Explorer's
-- order (audience/loaders/gss_topics.py writes them). The export serves them as the constructs
-- entry's optional topics; a construct without any carries no key.

ALTER TABLE concordance ADD COLUMN IF NOT EXISTS gss_topics ${TEXT_ARRAY};
