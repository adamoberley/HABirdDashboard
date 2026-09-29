# Third-party notices

HABirdDashboard's code and artwork are MIT-licensed (see [LICENSE](LICENSE)).
The two data files below come from other projects. They are lists of species
names rather than creative work, but they keep their original license and
attribution, and the MIT license does not cover them.

| File | What it is | Source | License |
|---|---|---|---|
| `avian/scripts/labels.txt` | BirdNET's species label list (`Scientific_Common` per line), the illustration pipeline's default species list | [BirdNET](https://github.com/kahst/BirdNET-Analyzer), K. Lisa Yang Center for Conservation Bioacoustics, Cornell Lab of Ornithology | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `TAXON_ALIASES` in `homeassistant/www/apt.js` (and its copies in `addons/birdframe/www/apt.js` and `dist/habird-card.js`) | BirdNET V2.4 label → current scientific name pairs, used to find artwork for renamed species | BirdNET-Go's [`internal/openfauna/data/aliases.json`](https://github.com/tphakala/birdnet-go/blob/main/internal/openfauna/data/aliases.json) by Tomi P. Hakala, at commit `5a94fc78` | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |

If you redistribute this project commercially, replace or remove these two
files, or check that your use is permitted by their license.
