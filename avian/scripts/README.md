# Generating illustrations

The collage art is generated, not hand-drawn. The repo ships 1,602 kachō-e
illustrations (801 species, a perched and a flight pose each). To restyle
them or build a set for your own region, the pipeline is a handful of scripts
in this directory.

## Pipeline

1. `pregen.py` renders each bird with Gemini 2.5 Flash Image, on a flat cream ground.
2. `cutout.py` removes the ground with BiRefNet and crops to the bird.
3. `build_masks.py` rebuilds the generated silhouette tables (`DIMS` + `MASKS`)
   in `homeassistant/www/masks.js`. **The collage packs birds by these masks
   and skips any species without one** — so new illustrations don't show in the
   collage until you run this (the atlas, image-only, already shows them).
4. `build_dirs.py` (optional) writes the `DIRS` flight-heading table into the
   same `masks.js`, used only by the ring **flow** layout. See
   [Flight directions](#flight-directions) below.
5. `verify.py` (optional) runs an adversarial species-ID + anatomy check.

```bash
pip install -r requirements.txt
export GEMINI_API_KEY='your-key'

# 1. generate (cream ground) for your region's species
python3 pregen.py --labels labels.txt --ebird-region US-CA

# 2. cut the ground off and crop
python3 cutout.py

# 3. rebuild the collage masks, then bump SKETCH_VERSION + IMG_VERSION in apt.js
python3 build_masks.py

# 4. (optional) flight headings for the ring "flow" layout
python3 build_dirs.py            # first pass over new -2.png flight renders
python3 build_dirs.py --verify   # cross-check pass; drops head/tail-confused birds
```

`--labels` takes any `Sci|Com` per-line file; the bundled `labels.txt` is the
full BirdNET 6K species list with English common names. `--ebird-region`
filters to species actually seen in your region (needs `EBIRD_API_KEY`).
Re-render one bird with `--species "Calypte anna|Anna's Hummingbird" --force`.

After regenerating, re-run `homeassistant/install.sh` to copy the new
illustrations into Home Assistant's www folder.

## Why a cream ground

The image model can't cut a clean transparent background on its own: it
leaves holes and fringes, worst on pale birds. Rendering on a flat,
consistent cream ground gives a known color that BiRefNet removes cleanly,
and the steady ground also holds the painting style together across the
whole set. `cutout.py` is the step that makes the backgrounds transparent.

## The prompt

`prompt.template.md` is the kachō-e prompt, sent verbatim per request with
`{sci_name}`, `{com_name}`, and `{pose}` substituted. Edit it to change the
style. `pregen.py` attaches up to three reference images per request:

- **Anatomy** (IMAGE 1): a Wikipedia photo of the target species, auto-fetched
  and cached in `assets/references/`. Anchors identity and markings. Drop your
  own `references/<slug>.jpg` to override.
- **Anti-reference** (IMAGE 2, optional): a photo of a look-alike the model
  drifts toward, captioned with what NOT to copy. Wired for blue corvids (vs
  Blue Jay) and swallows (vs Barn Swallow); add more in the `ANTI_REFS` table
  and place photos at `references/_anti_<key>.jpg`.
- **Style** (IMAGE 3, optional): a real Edo-period kachō-e print whose painting
  technique is borrowed. The genus-to-print mapping is in `pregen.py`'s
  `STYLE_REFS`. The prints are not bundled (they are someone else's art); put
  your own in `assets/references/styles/`. The Koson and Yoshida prints used
  originally are easy to find on the public web by the filenames in `STYLE_REFS`.

All three degrade gracefully: a missing reference is simply not attached.

## Hard species

`species-notes.json` holds one-line diagnostic addenda for species the model
gets wrong. Each note names the field marks that matter and the look-alikes to
avoid, and is appended to the prompt for that species. Add entries as you find
drift; they carry forward to every future regeneration of that bird.

## Flight directions

The ring **flow** layout banks every in-flight bird so it follows the circle's
tangent — a wheeling flock. To do that the renderer needs to know which way each
flight illustration (`<slug>-2.png`) is *already* pointing. `build_dirs.py` asks
Gemini Vision for the beak tip and tail tip of each flight render, turns the
tail→beak vector into a heading (degrees, `0` = right, `90` = down), and writes a
`var DIRS = {…}` table into `homeassistant/www/masks.js` next to `DIMS`/`MASKS`.

```bash
python3 build_dirs.py                 # all flight renders not already cached
python3 build_dirs.py larus-canus-2   # re-annotate one slug
python3 build_dirs.py --verify        # 2nd independent pass; drop disagreements
python3 build_dirs.py --check         # rebuild the DIRS table from dirs.json, no API calls
```

Notes:

- **Cached.** Results accumulate in `dirs.json`, so a normal run only annotates
  flight renders it hasn't seen — adding a region's birds costs only those birds.
- **Two passes.** Run the plain pass, then `--verify`. The cross-check runs a
  second independent read into `heading2`; headings whose two passes disagree by
  >40° (the classic head/tail confusion, e.g. gulls) are dropped rather than
  baked in backwards.
- **Omissions are fine.** Head-on or tail-toward-viewer poses have no in-plane
  direction; they're flagged `ambiguous` and left out of `DIRS`, so the renderer
  draws them upright. Only the ring flow layout cares — the default collage and
  the atlas ignore `DIRS` entirely.
- **Overrides.** `dirs_overrides.json` holds hand-verified headings that win over
  the vision pass for the occasional bird the model reverses.

## Verifying

`verify.py` sends each illustration back through Gemini Vision without telling
it the target species, then checks the guess, the wing/leg/tail counts, and
whether a stray perch crept in. It catches drift a quick eyeball misses.

```bash
python3 verify.py --labels labels.txt              # whole library -> verify-results.csv
python3 verify.py --labels labels.txt calypte-anna
```

## What actually goes wrong

- **Sticks.** Perched raptors often come back gripping a twig the prompt
  forbade. Generate 2-3 and keep the clean one.
- **Species drift.** The model collapses an uncommon species toward a common
  look-alike (a swift becomes a swallow). Fixes, in order: a sharper
  `species-notes.json` note with anti-feature language; an anti-reference; a
  different style print; a one-off `--species` regen.
- **Matched pair.** The perched and flight poses must read as the same
  individual. Review them side by side before locking.
