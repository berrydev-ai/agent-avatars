# Composable avatar parts

The build tooling can combine versioned part packs into deterministic 256×256
SVG avatars. A pack declares ordered slots, the variants in each slot, its
canvas, and whether its rights evidence permits public catalog use.

## Premium Flat local pack

The supplied Illustrator file has one top-level layer containing 20 character
groups. Its nested groups preserve editable vector structure, but almost all are
unnamed; they do not identify semantic parts such as hair, eyes, mouth, or
clothing. The current import therefore treats each complete character as one
`base` variant and combines it with:

- 12 backgrounds
- 8 optional accents
- 5 optional frames
- 6 optional badges

That produces 90,720 deterministic recipes without materializing the complete
cartesian product. The sampler selects evenly distributed recipe indexes so a
small preview covers the full range.

## Import and generate

Run from the repository root with Node 24.20.0:

```sh
npm run parts:import-premium-flat -- \
  --source /path/to/premium-flat-design-characters-svg \
  --output local/avatar-parts/premium-flat/pack.json

npm run parts:generate -- \
  --pack local/avatar-parts/premium-flat/pack.json \
  --output local/avatar-parts/premium-flat/sample-256 \
  --count 256
```

Open `local/avatar-parts/premium-flat/sample-256/index.html` to inspect the
sample. The pack, generated SVGs, recipes, and contact sheet live below
`local/avatar-parts/`, which is intentionally ignored by Git.

Both commands fail instead of overwriting an existing pack or output directory.
Choose a new output path for another run.

## Publication boundary

The supplied ZIP contains no license file, so every new import remains
`local-only`, and `assertPartPackPublishable()` prevents an unreviewed pack from
entering the public catalog.

On 2026-09-01, Berry Development, LLC confirmed ownership and approved download,
redistribution, commercial use, and modification for the reviewed 256-avatar
sample in PR #14. The catalog commits only that bounded sample, its recipes, and
its exact owned-work evidence hash. The complete source pack and unreviewed
combinations remain below the ignored `local/avatar-parts/` directory.

After rights approval, semantic curation can split the unnamed Illustrator
groups into compatible slots such as `hair`, `eyes`, `mouth`, `facial-hair`, and
`clothing`. The mixed-radix recipe engine already supports those additional
slots without enumerating every combination in memory.
