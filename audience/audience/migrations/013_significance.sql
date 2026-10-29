-- A lift's significance as its source calls it, at the source's own stated criterion (PAX's
-- message-test readouts mark each arm-vs-placebo cell at 90%). Null where the source makes no
-- call; a row with a moe carries its own test and leaves this null.
ALTER TABLE norms ADD COLUMN IF NOT EXISTS significant boolean;
