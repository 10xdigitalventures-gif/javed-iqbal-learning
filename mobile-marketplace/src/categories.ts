export const CATEGORIES = [
  'All',
  'Business',
  'Marketing',
  'Health & Wellness',
  'Finance',
  'Education',
  'Technology',
  'Personal Development',
  'Legal',
  'Real Estate',
] as const;
export type Category = (typeof CATEGORIES)[number];
