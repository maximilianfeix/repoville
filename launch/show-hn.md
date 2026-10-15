# Show HN draft (post yourself, Tue–Thu ~13:30 UTC)

**Title:** Show HN: Repoville – turn any Git repo into a walkable Minecraft-style city

**URL:** https://maximilianfeix.github.io/repoville/

**First comment:**

I built Repoville because I wanted to *see* a codebase the way you see a city from a plane: where the big districts are, where people are working right now, and which corners nobody has touched in years.

It reads a repo locally (file sizes, one `git log`) and generates a voxel city:
- folders are districts with roads and name signs,
- files are buildings; height comes from lines of code,
- the 10% most-changed files of the last year burn on the roof,
- TODO/FIXME density turns that share of the walls into ruins,
- files untouched for a year grow moss.

The main output is a single HTML file with a three.js viewer (React's repo is ~1.9 MB and renders at 60 fps without shadows on my laptop). It also exports `.schem`, `.litematic`, a ready-to-open world, or builds live on a Paper server over RCON — those are all tested against a real Paper 1.21.11 server.

Nothing is uploaded; the HTML contains paths and counts, not code.

Rough edges: very large repos (Linux) get folded into folder towers to stay under 4,000 buildings; the npm package isn't published yet [CONFIRM before posting]; Windows is untested locally [CONFIRM].

Which repo should I render next?
