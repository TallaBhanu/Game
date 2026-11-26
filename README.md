# Golconda 1518

An open-world, third-person exploration game in the browser, set in **Golconda Fort (Hyderabad) around 1518**, when Sultan Quli Qutb-ul-Mulk began rebuilding the old Kakatiya mud fort on the shepherd's hill ("Golla Konda") in granite.

You arrive at Fateh Darwaza as a traveller and wander freely through a living fort:

- **The new rampart.** Masons raise a stretch of the outer wall block by block. Porters carry stones on their heads up an earthen ramp, a timber shear-leg crane hoists blocks while a rope team hauls, stone-dressers chip away in the yard, two men lever a boulder, and a pair of bullocks drag granite on a sledge. The wall really grows while you watch.
- **The Sultan's procession.** Heralds with brass horns, kettle-drummers, standard bearers, a caparisoned royal elephant with a howdah, spearmen, the Sultan under a red parasol with yak-tail fan bearers, nobles and servants. They march from the palace, stop to inspect the rampart, pass through the bazaar, climb the winding road to Bala Hisar, hold court, and come back down. Townsfolk bow as he passes.
- **Nritya Mandap.** A dance court under a striped canopy with marigold garlands: spinning dancers, a seated ensemble (dholak, tabla, singer, cymbals) and an audience that applauds after each chakkar.
- **Moti Bazaar.** Stalls for pearls, spices, Kollur diamonds, kalamkari cloth, bangles, fruit, copperware, attar and paan. You can buy things and haggle, and shoppers wander between the stalls.
- **Landmarks.** Fateh Darwaza with spiked doors, the clapping portico (clap under the dome and the sound carries to the summit), the Durbar Hall of Bala Hisar with its throne, a Mahakali shrine, the royal palace, a step tank, a town of whitewashed houses, granite boulders and the Deccan plain outside the walls.
- **Day and night.** A full day passes in about 16 minutes. Torches light up at dusk, and the stars come out at night.
- **Sound.** All audio is generated in code: tabla in teental with a drone and a sarangi-like melody, kettle drums and horns, chisels clinking, the murmur of the bazaar, birds by day and crickets at night.

All of it is built procedurally with [three.js]. There are no image, model or audio files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (open with: npm run preview)
```

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk (Shift to run) |
| Mouse | Look around (click to capture the mouse; scroll to zoom) |
| Space | Jump |
| E | Talk / trade |
| 1 · 2 · 3 | Namaste · dance · clap |
| C | Clap (try it under the portico by the gate) |
| J | Journal (things to see + your satchel) |
| M | Map, with fast travel |
| T | Let two hours pass |
| N | Mute |
| Esc | Close panel / release mouse |

On phones and tablets: drag on the left half of the screen to walk, drag on the right half to look, and use the on-screen buttons for everything else.

## Code layout

```
src/
  main.js              game loop, interactions, journal triggers
  core/                engine pieces: physics (height field + colliders), input, audio, HUD, player, textures, util
  world/layout.js      THE MAP: every position for Golconda (walls, gates, road, bazaar, zones, procession route)
  world/terrain.js     granite hill + Deccan plain height field
  world/fort.js        static architecture (walls, bastions, gates, Bala Hisar, temple, palace, houses, trees, boulders)
  world/builder.js     geometry batching, arch/arcade generator, materials
  world/sky.js         sky dome, sun/moon and the day cycle
  life/characters.js   procedural people (with poses), elephant, oxen, props
  life/construction.js the rampart building site
  life/procession.js   the Sultan's procession
  life/dance.js        the dance court
  life/bazaar.js       the market and its stalls
  life/townsfolk.js    walkers, guards, priest, courtiers
```

## Roadmap

- More maps: Warangal Fort (Kakatiya kirti toranas), Brihadeeswara Temple in Thanjavur, Kanchipuram. Each new map should get its own `layout` + `fort`-style builder.
- Multiplayer: the simulation is already deterministic per seed, so other players can be synced as extra actors.
- Quests and characters with longer stories; horses and the Banjara traders' caravans.

## A note on history

The game is a loving reconstruction, not a survey. The layout follows the real fort loosely (the east-facing Fateh Darwaza, the clapping portico, the winding climb to the Bala Hisar durbar at the summit, the granite boulders), but many buildings visible at Golconda today are later Qutb Shahi work and are only suggested here.

[three.js]: https://threejs.org
