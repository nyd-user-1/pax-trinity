"""Label and one-line definition for every construct the survey loaders write.

The loaders add their own variable names and wording notes to each construct's concordance
row (survey.merge_concordance); the label and definition come from here so every source
writes the same text. Population constructs (sex, age_bucket, ..., registration, turnout)
are seeded by migration 002.
"""

CONSTRUCTS: dict[str, tuple[str, str]] = {
    # party and ideology
    "party_id_7": ("Party identification, 7-point",
                   "Party identification from strong Democrat to strong Republican, with independents who lean to a party placed beside it."),
    "ideology_7": ("Ideology, 7-point",
                   "Self-placement on a seven-point scale from extremely liberal to extremely conservative."),
    "ideology_5": ("Ideology, 5-point",
                   "Self-description from very liberal to very conservative on five points."),
    # trust and confidence
    "social_trust": ("Generalized social trust",
                     "Whether most people can be trusted or one needs to be careful in dealing with people."),
    "people_fair": ("People try to be fair",
                    "Whether most people would try to be fair or take advantage of you given the chance."),
    "people_helpful": ("People try to be helpful",
                       "Whether people mostly try to be helpful or mostly look out for themselves."),
    "trust_gov": ("Trust in the federal government",
                  "How much the federal government in Washington can be trusted to do what is right or to handle the nation's problems."),
    "confidence_federal_executive": ("Confidence in the executive branch",
                                     "Confidence in the people running the executive branch of the federal government."),
    "confidence_congress": ("Confidence in Congress",
                            "Confidence in the people running Congress (the national legislature)."),
    "confidence_press": ("Confidence in the press",
                         "Confidence in the people running the press."),
    "confidence_government": ("Confidence in the government",
                              "Confidence in the national government, asked without naming a branch."),
    "confidence_institutions": ("Confidence in other institutions",
                                "Confidence in a named institution not covered by its own construct; item_text names it."),
    # efficacy and responsiveness
    "efficacy_external": ("External political efficacy",
                          "Belief that officials care what people like the respondent think and that people like them have a say."),
    "efficacy_internal": ("Internal political efficacy",
                          "Belief that politics and government are not too complicated for the respondent to understand."),
    "parties_care": ("Parties care about opinions",
                     "Whether parties are interested in people's opinions and not only their votes."),
    # affect, approval, traits
    "thermometer_dem": ("Feeling thermometer: Democratic Party",
                        "Warmth toward the Democratic Party on a 0-100 thermometer."),
    "thermometer_rep": ("Feeling thermometer: Republican Party",
                        "Warmth toward the Republican Party on a 0-100 thermometer."),
    "pres_approval": ("Presidential job approval",
                      "Approval of the way the sitting president is handling the job."),
    "cand_trait_honest": ("Candidate trait: honest",
                          "How well 'honest' describes the major-party presidential candidate named in item_text."),
    "cand_trait_cares": ("Candidate trait: cares",
                         "How well 'really cares about people like you' describes the major-party presidential candidate named in item_text."),
    "cand_trait_strong_leader": ("Candidate trait: strong leadership",
                                 "How well 'provides strong leadership' describes the major-party presidential candidate named in item_text."),
    "cand_trait_knowledgeable": ("Candidate trait: knowledgeable",
                                 "How well 'knowledgeable' describes the major-party presidential candidate named in item_text."),
    # equality, mobility, redistribution
    "egalitarianism": ("Egalitarianism",
                       "Agreement with statements about equal opportunity and equal treatment; item_text gives the statement and its direction."),
    "gov_reduce_income_diff": ("Government should reduce income differences",
                               "Support for government action to reduce income differences between rich and poor."),
    "income_gap_too_large": ("Income differences too large",
                             "Agreement that differences in income in America are too large."),
    "get_ahead": ("How people get ahead",
                  "Whether hard work or luck and help from others matters most for getting ahead."),
    # nation
    "national_pride": ("National pride",
                       "How proud the respondent is of being American."),
    "national_pride_domain": ("National pride by domain",
                              "How proud the respondent is of America in the domain named in item_text."),
    "nationalism": ("Nationalism",
                    "Agreement that America is better than other countries or that one would rather be its citizen than any other's."),
    # religion and values
    "religious_attendance": ("Religious service attendance",
                             "How often the respondent attends religious services."),
    "life_importance": ("Importance in life",
                        "How important the life domain named in item_text is to the respondent."),
    "freedom_vs_security": ("Freedom or security",
                            "Which the respondent would choose if forced to pick between freedom and security."),
    # democracy
    "democracy_importance": ("Importance of living in a democracy",
                             "How important it is to live in a country governed democratically, 1-10."),
    "democracy_rating": ("How democratically the country is governed",
                         "Rating of how democratically the country is governed today, 1-10."),
    "political_system_eval": ("Political system evaluation",
                              "Whether the political system named in item_text is a good or bad way to govern the country."),
    # elections and primaries
    "elections_fair": ("Elections are fair",
                       "Agreement that elections are fair and accurately conducted, at the level named in item_text."),
    "primary_turnout_validated": ("Primary turnout, validated",
                                  "Share of adults with a voter-file record of voting in the primary named in item_text; respondents with no record count as non-voters."),
    "primary_party_validated": ("Party primary voted in, validated",
                                "Among adults with a voter-file record of voting in the primary named in item_text, whose primary they voted in."),
    # election returns
    "presidential_vote": ("Presidential vote",
                          "Official votes cast for each presidential ticket, with all-others write-ins and blank ballots."),
    # persuasion lift (ad-level effects from survey experiments)
    "lift_favorability": ("Lift: candidate favorability",
                          "Effect of one ad on the favorability index for its campaign's candidate, ad arm minus placebo, in points on a 0-100 scale."),
    "lift_vote_choice": ("Lift: vote choice",
                         "Effect of one ad on the vote-choice index for its campaign's candidate, ad arm minus placebo, in points on a 0-100 scale."),
    "lift_vote_choice_dichotomized": ("Lift: vote choice, dichotomized",
                                      "Effect of one ad on the share leaning to its campaign's candidate (vote-choice index above its midpoint, exactly at it counting half), in percentage points."),
}


def definition(name: str) -> tuple[str, str]:
    return CONSTRUCTS[name]
