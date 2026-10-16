# X thread draft (v0.6.0)

Post it yourself. Five posts: 1–4 are the thread, 5 is a reply under post 4 and is the only one with links.
Character counts are plain text as written below (X counts any URL as 23, so post 5 is shorter on X).
At most one emoji per post; none are used.

Before posting:
- Roofscapes (#58) landed on `main` after the v0.6.0 tag. They are not in the v0.6.0 changelog or release tarball, and the local site-dist demo build (05:38) predates the roofscape commit (05:55), so the live demos probably do not show them yet. Post 4 says "on main" for that reason. Re-render the demos (and cut a release) first if you want to say "in v0.6.0".
- Media for post 1: `docs/media/flyover.gif` (5.9 MB; README says it is rendered with the v2 textures) or `site-dist/media/hero-loop.mp4` (3.6 MB). The MP4 plays better on X, but check it shows the v2 textures before using it; I did not verify that.

---

**1/** (video attached: `docs/media/flyover.gif` or `site-dist/media/hero-loop.mp4`) — 223 chars

```
This city is the React codebase. Folders are districts, files are buildings, and the roofs on fire are the files that changed most this year.

Repoville v0.6.0 paints every block itself: 16×16 pixel tiles, no Mojang assets.
```

**2/** — 241 chars

```
Height is lines of code. ReactFiberWorkLoop.js is a 96-block tower with soul fire on top: 5,268 lines, 46 TODOs.

TODOs crack the walls. Files untouched for a year grow moss.

Fire means activity, not bad code. Moss means stable, not rotten.
```

**3/** — 241 chars

```
New in v0.6.0: every block state gets its own procedurally painted 16×16 tile. Hue-shifted colour ramps, grass sides, log rings, one facade per building family.

Still no Mojang assets in the file. ?textures=classic brings back the old look.
```

**4/** — 234 chars

```
Just landed on main: roofscapes. Flat roofs get gravel, green or pale decks, a stair housing, HVAC units scaled to the roof, and timber water tanks on wide roofs.

Landmark crowns got roof caps, so the skyline is no longer one colour.
```

**5/** (reply, links here only) — 274 chars (234 as X counts URLs)

```
One HTML file, built locally, no upload. Also exports .schem/.litematic to load in Minecraft.

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.

https://github.com/maximilianfeix/repoville
https://maximilianfeix.github.io/repoville/
```

Sources: README (legend, flyover alt text: ReactFiberWorkLoop.js 5,268 lines, soul fire, 46 TODOs; height formula gives 96 blocks for 5,268 lines), CHANGELOG 0.6.0, commit ae34373 (roofscapes).
