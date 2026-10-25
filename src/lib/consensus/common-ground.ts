// Common Ground (Brendan, 2026-09-24): the root's card. A hundred things
// Americans say is wrong — the complaints heard at kitchen tables, in town
// halls and in comment sections, from every side — each shown as something
// someone else said, for the reader to agree with, disagree with or pass on.
// On the last day of each month GovBlock publishes where the answers agree.
//
// The statements are written to stand alone, one idea each, in the plain
// words a person would use, and balanced so no side sees only its own
// grievances. `tid` is permanent: a statement that is reworded gets a new one,
// so a month's answers always mean the words that were shown.

export const COMMON_GROUND = {
  slug: "common-ground",
  title: "Common Ground",
} as const

export type GroundStatement = { tid: number; topic: string; text: string }

export const STATEMENTS: GroundStatement[] = [
  // Cost of living
  { tid: 1, topic: "Cost of living", text: "Groceries cost so much now that I plan meals around what's on sale, not what my family wants to eat." },
  { tid: 2, topic: "Cost of living", text: "A full-time job should be enough to pay rent and bills without a second job." },
  { tid: 3, topic: "Cost of living", text: "Companies used inflation as cover to raise prices more than their costs went up." },
  { tid: 4, topic: "Cost of living", text: "Hidden fees on tickets, hotels and bills should be banned; the price shown should be the price paid." },
  { tid: 5, topic: "Cost of living", text: "Child care costs as much as a mortgage, and that keeps parents out of work." },
  { tid: 6, topic: "Cost of living", text: "Government spending is a big reason prices went up." },
  { tid: 7, topic: "Cost of living", text: "Gas prices hit working people who have to drive much harder than anyone in Washington admits." },
  { tid: 8, topic: "Cost of living", text: "Tariffs end up being paid by shoppers, not by other countries." },
  // Housing
  { tid: 9, topic: "Housing", text: "My kids will never be able to afford a house in the town they grew up in." },
  { tid: 10, topic: "Housing", text: "Local zoning rules make it nearly impossible to build the housing people need." },
  { tid: 11, topic: "Housing", text: "Big investment firms buying up single-family homes should be limited." },
  { tid: 12, topic: "Housing", text: "Property taxes are pushing longtime homeowners out of their own homes." },
  { tid: 13, topic: "Housing", text: "Homeless encampments in public parks and sidewalks should not be allowed." },
  { tid: 14, topic: "Housing", text: "Rent control does more harm than good in the long run." },
  // Health care
  { tid: 15, topic: "Health care", text: "A hospital should have to tell you the price before it treats you, not after." },
  { tid: 16, topic: "Health care", text: "Insurance companies deny claims they know they should pay, hoping people give up." },
  { tid: 17, topic: "Health care", text: "Americans pay far more for the same prescription drugs than people in other countries." },
  { tid: 18, topic: "Health care", text: "Nobody should go bankrupt because they got sick." },
  { tid: 19, topic: "Health care", text: "Health insurance should not be tied to your job." },
  { tid: 20, topic: "Health care", text: "A government-run health system would be slower and worse than what we have." },
  { tid: 21, topic: "Health care", text: "Getting mental health care takes months of waiting, if you can find anyone at all." },
  { tid: 22, topic: "Health care", text: "Surprise bills from out-of-network doctors I never chose should be illegal." },
  // Government and trust
  { tid: 23, topic: "Government", text: "Members of Congress should not be allowed to trade individual stocks." },
  { tid: 24, topic: "Government", text: "There should be term limits for members of Congress." },
  { tid: 25, topic: "Government", text: "Both parties care more about beating each other than about solving problems." },
  { tid: 26, topic: "Government", text: "Lobbyists have more say over laws than voters do." },
  { tid: 27, topic: "Government", text: "Bills in Congress are too long for anyone, including the people voting on them, to read." },
  { tid: 28, topic: "Government", text: "The federal government has grown too big and does too many things badly." },
  { tid: 29, topic: "Government", text: "Government shutdowns punish ordinary workers for politicians' failures and should not be allowed." },
  { tid: 30, topic: "Government", text: "Supreme Court justices should serve fixed terms rather than for life." },
  { tid: 31, topic: "Government", text: "Too many important decisions are made by agencies nobody elected." },
  { tid: 32, topic: "Government", text: "The national debt is a crisis both parties keep ignoring." },
  { tid: 33, topic: "Government", text: "The age of our leaders is a real problem; there should be an upper age limit for office." },
  // Elections
  { tid: 34, topic: "Elections", text: "Voters should have to show a photo ID to vote." },
  { tid: 35, topic: "Elections", text: "Election Day should be a national holiday." },
  { tid: 36, topic: "Elections", text: "Gerrymandering lets politicians pick their voters instead of voters picking politicians." },
  { tid: 37, topic: "Elections", text: "Independent voters should be allowed to vote in primaries." },
  { tid: 38, topic: "Elections", text: "There is too much money in political campaigns." },
  { tid: 39, topic: "Elections", text: "Vote counts take too long; results should be known on election night." },
  { tid: 40, topic: "Elections", text: "Mail-in voting makes elections less secure." },
  { tid: 41, topic: "Elections", text: "I usually vote for the lesser of two evils rather than for someone I believe in." },
  { tid: 42, topic: "Elections", text: "Political ads should have to disclose who actually paid for them." },
  // Economy and work
  { tid: 43, topic: "Work", text: "The federal minimum wage is too low to live on." },
  { tid: 44, topic: "Work", text: "Small businesses are buried in paperwork and regulations big companies can afford to handle." },
  { tid: 45, topic: "Work", text: "Companies should not be allowed to make workers sign non-compete agreements for ordinary jobs." },
  { tid: 46, topic: "Work", text: "Too many good jobs have been shipped overseas." },
  { tid: 47, topic: "Work", text: "Job postings should have to list the pay." },
  { tid: 48, topic: "Work", text: "Tips should not be taxed." },
  { tid: 49, topic: "Work", text: "Social Security will not be there for me when I retire." },
  { tid: 50, topic: "Work", text: "Large corporations pay less in taxes than they should." },
  { tid: 51, topic: "Work", text: "Taxes are too complicated; most people should be able to file for free in minutes." },
  // Education
  { tid: 52, topic: "Education", text: "College costs too much for what it gives you." },
  { tid: 53, topic: "Education", text: "High schools should teach personal finance: taxes, credit and budgeting." },
  { tid: 54, topic: "Education", text: "Parents should have a bigger say in what their children are taught." },
  { tid: 55, topic: "Education", text: "Teachers are paid too little for the job they are asked to do." },
  { tid: 56, topic: "Education", text: "Trade schools and apprenticeships deserve as much respect and funding as college." },
  { tid: 57, topic: "Education", text: "Phones should be banned in classrooms." },
  { tid: 58, topic: "Education", text: "Public money should follow the student to the school their family chooses." },
  { tid: 59, topic: "Education", text: "Student loan debt should be forgiven." },
  // Safety and justice
  { tid: 60, topic: "Safety", text: "I don't feel as safe in my own neighborhood as I used to." },
  { tid: 61, topic: "Safety", text: "Retail theft is out of control and stores are locking up everyday items." },
  { tid: 62, topic: "Safety", text: "Police need more training in how to de-escalate." },
  { tid: 63, topic: "Safety", text: "Police departments are understaffed and response times are too slow." },
  { tid: 64, topic: "Safety", text: "Background checks should be required for all gun sales." },
  { tid: 65, topic: "Safety", text: "The right to own a gun should not be restricted any further." },
  { tid: 66, topic: "Safety", text: "People with a serious mental illness should be treated, not jailed." },
  { tid: 67, topic: "Safety", text: "Fentanyl dealers should face much tougher sentences." },
  { tid: 68, topic: "Safety", text: "The justice system treats the rich and the poor differently." },
  // Immigration
  { tid: 69, topic: "Immigration", text: "The southern border is not secure." },
  { tid: 70, topic: "Immigration", text: "People brought to the U.S. as children should have a path to citizenship." },
  { tid: 71, topic: "Immigration", text: "Legal immigration takes so long that it pushes people to come illegally." },
  { tid: 72, topic: "Immigration", text: "Employers who hire people here illegally should face real penalties." },
  { tid: 73, topic: "Immigration", text: "Cities are being overwhelmed by the number of migrants arriving." },
  // Technology and media
  { tid: 74, topic: "Technology", text: "Social media is harming kids, and the companies know it." },
  { tid: 75, topic: "Technology", text: "Tech companies collect and sell far too much of my personal data." },
  { tid: 76, topic: "Technology", text: "I can't tell what's true in the news anymore." },
  { tid: 77, topic: "Technology", text: "Big tech companies censor views they disagree with." },
  { tid: 78, topic: "Technology", text: "AI is going to take jobs faster than new ones are created." },
  { tid: 79, topic: "Technology", text: "Robocalls and scam texts should be stopped by the phone companies, not left to me." },
  { tid: 80, topic: "Technology", text: "Rural areas still don't have decent internet, and that holds them back." },
  { tid: 81, topic: "Technology", text: "Canceling a subscription should be as easy as signing up for it." },
  // Environment and energy
  { tid: 82, topic: "Energy", text: "Electric bills keep climbing and nobody can explain why." },
  { tid: 83, topic: "Energy", text: "Climate change is making weather disasters worse where I live." },
  { tid: 84, topic: "Energy", text: "The U.S. should produce more of its own oil and gas." },
  { tid: 85, topic: "Energy", text: "Home insurance is getting unaffordable or impossible to get where I live." },
  { tid: 86, topic: "Energy", text: "Everyone should have safe drinking water from the tap, and too many places don't." },
  { tid: 87, topic: "Energy", text: "Electric vehicles are being pushed on people before they are practical." },
  { tid: 88, topic: "Energy", text: "It takes far too long to get permits to build anything, from power lines to bridges." },
  // Community and daily life
  { tid: 89, topic: "Community", text: "Roads and bridges near me are in bad shape." },
  { tid: 90, topic: "Community", text: "Getting anything done with a government office means hours on hold or in line." },
  { tid: 91, topic: "Community", text: "Americans are lonelier than they used to be." },
  { tid: 92, topic: "Community", text: "People on the other side of politics aren't my enemies; we just disagree." },
  { tid: 93, topic: "Community", text: "Local news has disappeared, and nobody is watching city hall anymore." },
  { tid: 94, topic: "Community", text: "Veterans wait too long for the care they were promised." },
  { tid: 95, topic: "Community", text: "Seniors are being targeted by scams, and not enough is done to stop it." },
  { tid: 96, topic: "Community", text: "Families need paid leave when a baby is born or a parent is sick." },
  { tid: 97, topic: "Community", text: "Farmers are squeezed by big buyers and rising costs until the family farm can't survive." },
  { tid: 98, topic: "Community", text: "Sports betting ads are everywhere, and gambling addiction is rising." },
  { tid: 99, topic: "Community", text: "The country is more divided now than at any time in my life." },
  { tid: 100, topic: "Community", text: "Most Americans agree on more than politicians and the media let on." },
]

export const statementOf = (tid: number) => STATEMENTS.find((s) => s.tid === tid) ?? null

/** The month a release covers, "2026-09", and the day it is published: the month's last. */
export function monthOf(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const last = new Date(Date.UTC(y, m + 1, 0))
  return { key: `${y}-${String(m + 1).padStart(2, "0")}`, name: date.toLocaleString("en-US", { month: "long", timeZone: "UTC" }), releases: last.toLocaleString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) }
}
