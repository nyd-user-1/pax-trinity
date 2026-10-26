"""Harmonized response options. Every loader that writes these constructs uses these labels,
so a construct's rows line up across sources. Definitions live in the concordance seed."""

SEX = ("Male", "Female")

AGE_BUCKET = ("18-29", "30-44", "45-64", "65+")

RACE_ETH = (
    "Hispanic or Latino",
    "White",                      # non-Hispanic, White alone
    "Black",                      # non-Hispanic, Black alone
    "Asian or Pacific Islander",  # non-Hispanic, Asian alone or NHPI alone
    "Other or multiracial",       # non-Hispanic, AIAN alone, some other race alone, two or more
)

EDUCATION_4 = ("HS or less", "Some college", "BA", "Grad")

HH_INCOME_BUCKET = (
    "Under $25,000",
    "$25,000-$49,999",
    "$50,000-$74,999",
    "$75,000-$99,999",
    "$100,000-$149,999",
    "$150,000 or more",
)

CITIZENSHIP = ("Citizen by birth", "Naturalized citizen", "Not a citizen")

CVAP = "Citizen, 18 and over"
