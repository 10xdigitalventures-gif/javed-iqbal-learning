// Shared category list for marketplace discovery.
// Shown as filter tabs on the directory and as a selector during onboarding.
export const CATEGORIES = [
  "Business",
  "Marketing",
  "Health & Wellness",
  "Finance",
  "Education",
  "Technology",
  "Personal Development",
  "Legal",
  "Real Estate",
] as const;

export type Category = (typeof CATEGORIES)[number];
