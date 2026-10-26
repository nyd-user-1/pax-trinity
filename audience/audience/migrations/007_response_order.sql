-- The coded order of a construct's response options, for bulk-tier constructs whose value
-- labels do not sort alphabetically into their questionnaire order (audience/bulk.py writes
-- it). The export lists a construct's options by ordinal; a construct with no rows here
-- keeps the alphabetical order.

CREATE TABLE IF NOT EXISTS response_order (
  source           text NOT NULL,
  construct        text NOT NULL,
  response_option  text NOT NULL,
  ordinal          integer NOT NULL,
  PRIMARY KEY (source, construct, response_option)
);
