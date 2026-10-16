# r/coolgithubprojects draft (post yourself)

Check the sub's current rules and flair before posting. Post as a link to the repo or as a text post with the repo link in the body. Attach `docs/media/flyover.gif` or `docs/media/hero-react.jpg` if the post type allows media.

Language label: the code is TypeScript (83 tracked `.ts` files in src/, viewer/, test/ and config; the only non-TS scripts are two `.mjs` helpers: scripts/make-fixtures.mjs and test/e2e/paper.mjs), `package.json` ships a `repoville` bin, and it runs from the command line, so `[TypeScript CLI]` is accurate.

---

**Title:**

```
[TypeScript CLI] Repoville - turn any Git repo into a Minecraft-style city you can walk through in your browser
```

**Body:**

```
Repoville reads a Git repo on your machine and builds a voxel city from it:

- folders are districts with roads, a plaza and a name sign
- files are buildings; height comes from non-blank lines of code
- the 10 % of files with the most commits in the last year burn on the roof, the top 2 % get soul fire
- TODO/FIXME/HACK/XXX density turns that share of the walls into cracked bricks and cobwebs
- files with no commit for over a year grow moss and vines

Fire means activity, not bad code. Moss means stable, not rotten.

The main output is one self-contained HTML file (React: 7,165 files, 1.9 MB). You can also export .schem / .litematic or a ready-to-open world and load it in Minecraft Java Edition.

Recent: every block state gets its own procedurally painted 16x16 pixel tile (v0.6.0), and v0.7.0 adds rooftops with HVAC units and water tanks, crosswalks, plaza benches and animated water. No Mojang assets are bundled.

Live demos (React, Linux, ripgrep, Flask, fzf, and Repoville itself):
https://maximilianfeix.github.io/repoville/

Run it on any repo (needs Node.js 22+ and git):

    npx --package=https://github.com/maximilianfeix/repoville/releases/latest/download/repoville.tgz repoville facebook/react --open

Use `.` for the current folder, owner/repo, or any git URL. Nothing is uploaded; the HTML contains paths and counts, never file contents.

Honest limits:
- Not on npm yet, so the command above runs the release tarball from GitHub.
- Windows is untested (dev machine is macOS).
- Big repos are folded: above 4,000 buildings the deepest folders merge into landmark towers, and the city is capped at 1024x1024 blocks. Linux (95,948 files) takes about 4.5 minutes to clone cold, then ~25 s to render warm.
- The GitHub Action is tested locally but has not run on GitHub-hosted runners yet.

MIT licensed: https://github.com/maximilianfeix/repoville

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
```

Notes for you:
- Roofscapes and street detail ship in v0.7.0 and are visible in the demos.
- All numbers above are from README.md (demo table, "How big can a repo be?", legend) and CHANGELOG.md.
