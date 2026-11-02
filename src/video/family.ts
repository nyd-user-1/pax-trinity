// The Yes on 3 family's ids alone, free of zod and the schemas, so a client surface that only lists them
// (clips-app's chooser menu) doesn't carry the validator. specs.ts re-exports both names.

/** The Yes on 3 family, the four cards a recorded take can be set in (docs/briefs/record-template-flow.md):
 *  each vertical, its length from `seconds`, a take under it as `backdrop`. */
export const YES_ON_3_FAMILY = ["yes-on-3-card", "yes-on-3-captions", "yes-on-3-explainer", "yes-on-3-quote"] as const
export type YesOn3TemplateId = (typeof YES_ON_3_FAMILY)[number]
