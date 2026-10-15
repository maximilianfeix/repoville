export const SITE = 'https://maximilianfeix.github.io/repoville';

export function badgeMarkdown(owner?: string, repo?: string): string {
  const target = owner && repo ? `${SITE}/r/${owner}/${repo}` : SITE;
  return `[![Visit this repo in Repoville](https://img.shields.io/badge/visit_this_repo-in_Repoville-4E8C3A?style=for-the-badge&labelColor=23262E)](${target})`;
}
