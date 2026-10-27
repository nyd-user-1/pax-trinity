-- The publisher's subject tags for ANES and CES questions, verbatim and in the publisher's
-- order (audience/loaders/anes_topics.py, ces_topics.py write them), beside concordance's
-- gss_topics. The export serves a construct's tags from all three as its optional topics.

ALTER TABLE concordance ADD COLUMN IF NOT EXISTS anes_topics ${TEXT_ARRAY};
ALTER TABLE concordance ADD COLUMN IF NOT EXISTS ces_topics ${TEXT_ARRAY};
