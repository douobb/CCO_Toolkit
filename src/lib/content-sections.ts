export const contentSections = ['tools', 'guides', 'blog'] as const;
export type ContentSection = (typeof contentSections)[number];
