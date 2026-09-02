# AGENTS.md — generate bird illustrations for your location

**This repo's main agent-assisted task:** generate kachō-e illustrations for
the bird species at *your* location (the ones the bundled library is missing),
in the same style as the rest, and get them into the card.

A human can hand their AI coding agent (Claude Code, Cursor, etc.) this one
line:

> "Follow AGENTS.md to generate bird illustrations for my birds."

The agent should then work through the steps below, pausing only at the points
marked **ASK THE USER**. (Contributor build/test notes are at the very bottom.)

---

## 0. Prerequisites — ASK THE USER first

- **A billing-enabled Google Gemini API key.** Image generation is **not** on
  the free tier — a free key returns `HTTP 429 ... quota ... limit: 0`. Get one
  at <https://aistudio.google.com/apikey> and **enable billing** on its project.
  Cost is roughly **$0.04 per image** (2 images per species); a typical missing
  set runs a few dollars.
- **Python 3.10+** (always) and **Node 18+** (only to rebuild the card).
- Their **BirdNET-Go species list** — Step 1.

Don't generate anything until the user confirms a billing-enabled key. That 429
is the #1 thing that wastes a run.

---

## 1. Get the species list for your location

Pick one:

**A. Download the CSV from the BirdNET-Go dashboard** *(recommended — covers
every species likely at your location, not just what's been heard so far).*
This list is the **complete** set of species BirdNET-Go can report at this
location (its label list filtered by the range filter), so illustrating it once
means no bird will ever show up without artwork — there is no open-ended
"new bird" case to handle later, short of the user moving the station or
loosening the range-filter threshold.

1. Open your BirdNET-Go web UI (e.g. `http://homeassistant.local:8080`).
2. Go to the **Species** page — the per-location species list (each with an
   occurrence score). Use its **export / download** to save a **CSV**.
3. Any CSV with `Common Name` and `Scientific Name` columns works (other
   columns are ignored). Note the file path.

**B. Pull straight from the station** *(no download).* Skip the CSV and let the
pipeline read exactly what your station has detected:
`--from-birdnet http://<your-birdnet-go>:8080` (used in Step 3). Use this only
if the machine running the agent can reach your BirdNET-Go.

---

## 2. One-time setup

From the repo root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r avian/scripts/requirements.txt certifi
```

**macOS only:** the system Python often can't verify HTTPS, which silently
breaks the Wikipedia + Gemini calls (`CERTIFICATE_VERIFY_FAILED`). Export a CA
bundle for **every** pipeline command in this session:

```bash
export SSL_CERT_FILE="$(.venv/bin/python -m certifi)"
```

Provide the Gemini key without putting it in shell history or git:

```bash
echo 'YOUR_GEMINI_KEY' > avian/scripts/.gemini_key   # already gitignored
export GEMINI_API_KEY="$(tr -d '[:space:]' < avian/scripts/.gemini_key)"
```

### Style references — do this; it's what keeps your birds matching the set

The bundled art was generated with ~10 public-domain Edo-period kachō-e
woodblock prints as a *style* reference (only the painting technique is
borrowed). They aren't committed (third-party scans). Fetch them:

```bash
mkdir -p avian/assets/references/styles
UA="habird-styleref/1.0 (+https://github.com/adamoberley/HABirdDashboard)"
while IFS='|' read -r fn url; do
  curl -sSL -A "$UA" -o "avian/assets/references/styles/$fn" "$url"
done <<'REFS'
01-sparrows-on-bamboo-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/a/a0/Tapuit_bij_bamboe%2C_RP-P-1999-489.jpg
02-cawing-crow-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/a/a3/Cawing_crow_by_Ohara_Koson.jpg
03-jays-on-berry-tree-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/b/b1/Koson_-_jays-on-berry-tree.jpg
04-kingfisher-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/1/19/IJsvogel%2C_AK-RAK-2000-9.jpg
05-owl-on-ginkgo-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/9/90/Scops_Owl%2C_Cherry_Blossoms%2C_and_Moon_by_Sh%C5%8Dson.jpg
06-goose-flying-in-moonlight-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/7/74/Gans_bij_volle_maan%2C_RP-P-1999-503.jpg
07-swallows-in-flight-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/4/4c/Drie_roodstuitzwaluwen_in_duikvlucht%2C_RP-P-1999-400.jpg
08-crane-in-small-water-Koson.jpg|https://upload.wikimedia.org/wikipedia/commons/1/1a/Vissende_kraanvogel_in_ondiep_water%2C_RP-P-2005-470.jpg
09-cockatoo-Yoshida.jpg|https://upload.wikimedia.org/wikipedia/commons/c/cf/Twee_kaketoes_op_tak_met_pruimenbloesem%2C_RP-P-2005-472.jpg
10-mandarin-ducks-Yoshida.jpg|https://upload.wikimedia.org/wikipedia/commons/9/99/Mandarijneenden%2C_RP-P-1999-568.jpg
REFS
# Shrink to ~1024px so each API request stays small:
.venv/bin/python - <<'PY'
from pathlib import Path
from PIL import Image
for f in sorted(Path("avian/assets/references/styles").glob("*.jpg")):
    im = Image.open(f).convert("RGB"); w, h = im.size
    if max(w, h) > 1024:
        s = 1024 / max(w, h); im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
    im.save(f, "JPEG", quality=88, optimize=True)
PY
```

(Generation still works without these, but the style drifts from the bundled
set — so don't skip it if you want them to match.)

---

## 3. Generate → cut out → masks → directions → card

If you used the **CSV** (option A), convert it to the `Sci|Com` label format the
pipeline reads (skip if using `--from-birdnet`):

```bash
.venv/bin/python - "PATH/TO/your-list.csv" <<'PY' > avian/scripts/mybirds.txt
import csv, sys
for r in csv.DictReader(open(sys.argv[1])):
    sci = (r.get("Scientific Name") or "").strip()
    com = (r.get("Common Name") or "").strip()
    if sci and com:
        print(sci + "|" + com)
PY
```

**Generate** — renders each bird on a flat cream ground. It **skips species
already illustrated**, so only the ones your library is missing cost anything:

```bash
.venv/bin/python avian/scripts/pregen.py --labels avian/scripts/mybirds.txt --sleep 6
# …or straight from the station instead of a CSV:
# .venv/bin/python avian/scripts/pregen.py --from-birdnet http://homeassistant.local:8080 --sleep 6
```

**Cut** the cream ground to transparency. First run downloads a ~1 GB matting
model; on CPU it's ~6 s/image:

```bash
caffeinate -i .venv/bin/python avian/scripts/cutout.py   # drop `caffeinate -i` off macOS
```

> If your tool kills long-running commands, just run `cutout.py` again — it's
> idempotent (skips already-transparent files) and resumes where it stopped.

**Rebuild masks.** The collage packs birds by their outline, so every species
needs a 1-bit silhouette mask in `homeassistant/www/masks.js` (`DIMS` + `MASKS`).
Derived from the cutout PNGs' alpha — **new illustrations don't appear in the
collage until you run this**, even though the atlas (image-only) already shows
them:

```bash
.venv/bin/python avian/scripts/build_masks.py
```

**Bake in flight directions (optional).** The ring **flow** layout banks each
in-flight bird along the circle, which needs to know which way its flight
illustration already points. `build_dirs.py` asks Gemini Vision for the beak/tail
points of every `<slug>-2.png` and writes the `DIRS` table into the same
`masks.js`. It **skips species already annotated** (cached in `dirs.json`), and
ambiguous/head-on birds are omitted (left upright). Skip this and the new birds
simply stay upright in flow mode — the default collage is unaffected:

```bash
.venv/bin/python avian/scripts/build_dirs.py            # first pass (new flight renders)
.venv/bin/python avian/scripts/build_dirs.py --verify   # cross-check pass; drops reversed birds
```

**Bump the cache-bust, then build the card.** Bump `SKETCH_VERSION` *and*
`IMG_VERSION` in `homeassistant/www/apt.js` (so browsers drop stale artwork),
then inline the new tables into the shipped card:

```bash
node homeassistant/card/build.js     # writes dist/habird-card.js with new masks + dirs
```

---

## 4. Quality check (recommended)

```bash
.venv/bin/python avian/scripts/verify.py --labels avian/scripts/mybirds.txt
```

This re-shows each new illustration to Gemini Vision *without* telling it the
species and flags wrong-species drift, anatomy errors, and stray perches into
`verify-results.csv`. Also eyeball the new PNGs in `avian/assets/illustrations/`.

`verify.py` is a *bird* check, so it will flag every intentional non-bird in
your list as an error — expect noise, don't act on it blindly.

**Screen the non-birds separately — ASK THE USER to look at these.** Your
station's list almost certainly includes frogs, insects, bats or mammals, and
those fail in two ways that a quick scroll through thumbnails will not catch:
a genus the model doesn't recognise comes back as a *songbird* (a nice-looking
warbler captioned as a cicada), and a non-flyer's `-2` pose comes back with
*feathered wings grafted on*. Pull the non-avian species out of your list and
review just those renders, at full size.

To redo a bad one, add a one-line diagnostic note to
`avian/scripts/species-notes.json` (it carries forward), then regenerate just
it. For a non-bird the note has to countermand the bird prompt outright —
copy the `Vulpes vulpes` entry's shape: state what the animal is, say to ignore
every instruction about wings/feathers/beaks/perching, and redefine both poses
("perched" = at rest, "in flight" = moving on the ground). For something that
simply cannot fly, deleting the `-2` file is cleaner than fixing it — the card
falls back to the perched pose; just prune the slug from
`avian/scripts/dirs.json` at the same time so no stale flight heading is left
behind.

```bash
.venv/bin/python avian/scripts/pregen.py --species "Genus species|Common Name" --force
.venv/bin/python avian/scripts/cutout.py <slug> <slug>-2
.venv/bin/python avian/scripts/build_masks.py && node homeassistant/card/build.js
```

(Slug = scientific name lowercased with non-alphanumerics turned to `-`, e.g.
`Passer domesticus` → `passer-domesticus`.)

---

## 5. Get them into your card

**A. Contribute back (easiest — and it helps the next person).** Open a pull
request adding your new PNGs, the updated `homeassistant/www/masks.js`, and the
rebuilt `dist/habird-card.js`. Once merged and released, the official HACS card
and its CDN cover your birds automatically — nothing for you to host.

**B. Self-host (private / immediate).** New species only show in the collage if
their **masks are baked into the card you load** — so you must use *your*
rebuilt `dist/habird-card.js`, not the official one. Then either:
- push your changes to your fork and point the card's **Artwork base URL**
  (`image_base`) at it:
  `https://cdn.jsdelivr.net/gh/<you>/HABirdDashboard@<branch>/avian/assets/`, or
- go fully offline: copy `avian/assets/` to `/config/www/habird-art/`, set
  `image_base: /local/habird-art/`, and add your rebuilt `dist/habird-card.js`
  as a dashboard resource.

(Standalone webpage install instead of the card? `homeassistant/install.sh`
copies `homeassistant/www/` — including the rebuilt `masks.js` — plus the
artwork into `/config/www/habird/`; no card build needed.)

---

## Gotchas (the ones that actually bite)

- **Gemini `429 ... limit: 0`** — the key is free-tier; image generation needs
  billing enabled on its Google Cloud project.
- **macOS `CERTIFICATE_VERIFY_FAILED`** — you didn't `export SSL_CERT_FILE=…`
  (Step 2). It affects both the Wikipedia reference fetch and the Gemini call.
- **`cutout.py` dies partway** — re-run it (idempotent). On macOS prefix with
  `caffeinate -i` so the machine sleeping mid-run can't interrupt it; if a tool
  times out long commands, cut in batches by passing slugs.
- **New species don't appear in the collage** — the card's silhouette masks are
  inlined in `dist/habird-card.js`; you must rebuild it (`node
  homeassistant/card/build.js`) *and* load that rebuilt file. New PNGs alone
  aren't enough.
- **Style looks off / inconsistent** — you skipped the style references (Step 2).
- **A frog / cicada / cricket came back as a songbird** — the model didn't
  recognise the genus and fell back on the rest of the prompt, which describes a
  bird. Nothing errors; the render just isn't the right animal. Needs a
  `species-notes.json` entry shaped like `Vulpes vulpes` (Step 4).
- **A mammal's flight pose has wings** — same root cause from the other side:
  `-2` asks for "wings spread" and the model obliges, so you get a winged dog or
  a winged echidna. Usually the right answer is to delete the `-2` file (the card
  falls back to perched) and prune that slug from `dirs.json`.
- **New birds fly upright in the ring "flow" layout** — you skipped
  `build_dirs.py` (or it omitted them as ambiguous). They have no heading in the
  `DIRS` table, so the renderer can't bank them. Harmless for the default
  collage; re-run `build_dirs.py` to annotate them.
- **A deleted `-2` still shows up in `DIRS`** — `dirs.json` is a cache keyed by
  slug and is not pruned automatically. Drop entries whose PNG no longer exists,
  then `build_dirs.py --check` (rebuilds the table from cache, no API calls).

---

## Working on the card itself (contributors)

Not generating art — changing the card/page code? The source of truth is
`homeassistant/www/` (`apt.js`, `index.html`, `styles.css`); the HACS card is
built from it.

```bash
node homeassistant/card/build.js   # rebuild dist/habird-card.js from www/
npm test                           # jsdom test suite (run after edits)
```

`avian/scripts/README.md` documents the illustration pipeline internals
(prompt, references, per-species tuning). `CHANGELOG.md` tracks releases.
