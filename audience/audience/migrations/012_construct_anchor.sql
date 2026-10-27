-- The construct layer's anchors in the field's own trend lists: GSS Key Trends and the ANES
-- Guide to Public Opinion and Electoral Behavior (audience/canonical.py reads them). Each row
-- is one list item and the construct it anchors, keyed by the list and the publisher's own
-- id for the item, so an item anchors exactly one construct. A concept both lists track is
-- one construct with an anchor from each. subject and subtopic are the list's own filing
-- (Politics / Confidence & Power; Partisanship and Evaluation of Political Parties / Party
-- Identification), which a construct table groups by. construct.anchor stays the construct's
-- citation line. audience/construct_layer.py writes this table with the other two.

CREATE TABLE IF NOT EXISTS construct_anchor (
  list          text NOT NULL,
  item_key      text NOT NULL,
  construct_id  text NOT NULL,
  item          text NOT NULL,
  subject       text,
  subtopic      text,
  url           text NOT NULL,
  ordinal       integer NOT NULL,
  PRIMARY KEY (list, item_key)
);
