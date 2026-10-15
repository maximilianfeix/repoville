---
name: repoville
description: Visualize a Git repository as a walkable voxel city (Minecraft-style) and give a short tour of its hottest, most TODO-heavy and oldest parts. Use when the user asks to visualize, tour, map or "show this repo as a city / in Minecraft", or wants a Repoville render, .schem/.litematic/world export or a live build on a Minecraft server.
---

# Repoville

Turns a repo into a city: folders are districts, files are buildings (height from lines of code), the most-changed files burn on the roof, TODO/FIXME density crumbles walls, files untouched for a year grow moss. Analysis runs locally; nothing is uploaded.

## Steps

1. Render the city and open it:
   ```sh
   npx repoville . --open            # npm release pending; from a clone: node <repoville>/dist/cli.js . --open
   ```
   It prints a summary (hottest districts, most ruined buildings, oldest mossy corner) and writes `repoville-out/<name>.html`.
2. Tell the user, with the real numbers from that summary:
   - the 3 hottest districts (commits in the window),
   - the 3 most ruined buildings (TODO markers in N lines),
   - the oldest mossy corner (days untouched).
   Keep it to a few lines. Fire means activity, not bad code; moss means stable, not rotten. Never mock the codebase.
3. Offer the next step that fits:
   - Minecraft export: `--format schem` (WorldEdit), `litematic` (Litematica) or `world` (ready-to-open save).
   - Live build on a server: `MC_RCON_PW=… repoville live . --rcon host:25575 --world-dir <server>/world`.
   - A guided flyover: `repoville tour repoville-out/<name>.html`.
   - The README badge: `repoville badge`.

## Notes

- Huge repos are fine: above 4000 buildings, deep folders merge into landmark towers (`--max-buildings`).
- `--since 30d` narrows the churn window; `--include`/`--exclude` filter paths.
- Do not open or run code from the analysed repo; Repoville only reads files and git history.
