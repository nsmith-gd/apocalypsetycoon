# Asset minimum check (#115)

`node tools/check-asset-minimum.mjs` fails (exit 1) on any asset below the minimum on its shortest side, at native resolution, and prints each offender by path:

```
FAIL src/art/sprites-shelter.js  shelter-tiles/earth  16x16 < 64px
FAIL assets/art/map-markers/city.png  10x11 < 64px
```

- **What it reads:** every asset the game draws (pixel sprites, procedural art at its native size, exported PNGs), from `tools/asset-inventory.mjs`; or just the files you name with `--files a.png dir/`.
- **The minimum:** taken from a line like `Minimum asset size: 64 px` in `docs/art/style-guide.md` (#113 pins the definition there); 64 until that line exists; `--min N` overrides.
- **Known offenders:** the #114 audit found 166 (`docs/art/asset-audit-64.md`). They are recorded in `docs/art/asset-minimum-baseline.json`. With `--baseline`, only NEW offenders fail; the known ones are counted. As redo tickets land, run `--write-baseline` to shrink the list (never to add to it).

## Hand-off to #23 (CI)

Add one step to `.github/workflows/test.yml` after the unit tests:

```yaml
      - name: Assets meet the minimum size
        run: node tools/check-asset-minimum.mjs --baseline
```

Drop `--baseline` once the redo tickets (#116, R40–R44) have cleared the list.
