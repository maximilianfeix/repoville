export const SITE = 'https://maximilianfeix.github.io/repoville';

export function badgeMarkdown(owner?: string, repo?: string): string {
  const target = owner && repo ? `${SITE}/r/${owner}/${repo}` : SITE;
  return `[![Visit this repo in repoville](https://img.shields.io/badge/visit_this_repo-in_repoville-356449?style=for-the-badge&labelColor=20231F)](${target})`;
}
