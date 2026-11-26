# Golconda 1518

An open-world, third-person exploration game in the browser, set in **Golconda Fort (Hyderabad) around 1518**, when Sultan Quli Qutb-ul-Mulk began rebuilding the old Kakatiya mud fort on the shepherd's hill ("Golla Konda") in granite.

You ride in on horseback along the road from Bhagnagar and explore a living, fully built fort, on foot, on horseback or driving a bullock cart:

- **Horses and bullock carts.** Press **F** next to one to mount it. Horses walk on with **W** and gallop with **Shift**; you steer with **A/D**. Carts are slow and steady. There are horses at the caravanserai outside Fateh Darwaza, by the palace and in the bazaar. Carts and patrolling horsemen travel the roads.
- **Closer to the real Golconda.** You climb to the summit by the ~380 stone steps from Bala Hisar Darwaza (or the winding road), past the Badi Baoli stepwell. The royal palaces and the Rani Mahal (zenana, with its Persian niches) stand on a great platform at the foot of the hill, and the Nagina Bagh garden lies just inside the gate.
- **The fort, complete.** Three rings of granite walls: the outer curtain with Fateh Darwaza and Banjara Darwaza, the middle wall with **Bala Hisar Darwaza** (the clapping portico stands just behind it, as at the real fort), and the summit citadel. Inside are the Habshi Kamans arches over the climb, the granaries, the Silah Khana armoury, the Ramdas cell, the Ibrahim Mosque, a Mahakali shrine and the Durbar Hall at the top.

- **The Naya Qila works.** Outside the walls to the north-east, masons raise the first stretch of a new outer enclosure, block by block. Porters carry stones on their heads up an earthen ramp, a timber shear-leg crane hoists blocks while a rope team hauls, stone-dressers chip away in the yard, two men lever a boulder, and a pair of bullocks drag granite on a sledge. The wall really grows while you watch.
- **The Sultan's procession.** Heralds with brass horns, kettle-drummers, standard bearers, a caparisoned royal elephant with a howdah, spearmen, the Sultan under a red parasol with yak-tail fan bearers, nobles and servants. They march from the palace, stop to inspect the rampart, pass through the bazaar, climb the winding road to Bala Hisar, hold court, and come back down. Townsfolk bow as he passes.
- **Nritya Mandap.** A dance court under a striped canopy with marigold garlands: spinning dancers, a seated ensemble (dholak, tabla, singer, cymbals) and an audience that applauds after each chakkar.
- **Moti Bazaar.** Stalls for pearls, spices, Kollur diamonds, kalamkari cloth, bangles, fruit, copperware, attar and paan. You can buy things and haggle, and shoppers wander between the stalls.
- **Landmarks.** Fateh Darwaza with spiked doors, the clapping portico (clap under the dome and the sound carries to the summit), the Durbar Hall of Bala Hisar with its throne, a Mahakali shrine, the royal palace, a step tank, a town of whitewashed houses, granite boulders and the Deccan plain outside the walls.
- **Day and night.** A full day passes in about 16 minutes. Torches light up at dusk, and the stars come out at night.
- **Sound.** All audio is generated in code: tabla in teental with a drone and a sarangi-like melody, kettle drums and horns, chisels clinking, the murmur of the bazaar, birds by day and crickets at night.

People and animals are realistic, rigged 3D models (CC BY, from Sketchfab: see [CREDITS.md](CREDITS.md)): townsmen in kurtas, women in saris, Akhal-Teke horses, black Deccani draught bulls, the royal elephant, donkeys and camels. One set of Mixamo animations (walk, idle, run, dance, gestures) is retargeted onto every human body at runtime, with procedural pose layers for sitting, bowing, carrying loads on the head, hammering, drumming and riding. To keep it fast, the nearest ~34 people get realistic bodies and everyone further away is drawn with a light stand-in.

It is built with [three.js]. The architecture is procedural. Surfaces use real, CC0-licensed photo-scanned textures from [Poly Haven] (granite, red Deccan laterite soil, plaster, timber). The sky is a physically based daylight model that also lights the scene, and post-processing adds ambient occlusion and bloom. The horse model comes from the three.js examples. Press **G** to switch between high and fast graphics.

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
| F | Mount a horse / drive a bullock cart / get down |
| G | Graphics quality (high / fast) |
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
  life/mounts.js       rideable horses + bullock carts, road traffic
  world/grass.js       instanced dry-grass tufts with wind
public/textures/       CC0 PBR texture sets (Poly Haven)
public/models/         glTF models (prepared with tools/prepare-models.mjs)
tools/                 model preparation scripts (rename bones, simplify, compress)
viewer.html            dev-only model/pose viewer (npm run dev, then open /viewer.html)
  life/assets.js       model loading + Mixamo retargeting
  life/realistic.js    realistic human bodies + pose layers
  life/crowd.js        level-of-detail pool for realistic people
  life/animals.js      camels, donkeys, grazing bulls
```

## Better 3D models: the desktop pipeline

Characters, animals and buildings will only look truly realistic with hand-made or AI-generated 3D models. The intended workflow:

1. Install **Blender** (free) and the **Blender MCP** add-on (github.com/ahujasid/blender-mcp) on your desktop, and connect it to Claude Code running on that machine. Claude can then build, edit and export scenes in Blender for you. The add-on can also pull Poly Haven assets and generate models with Hyper3D Rodin.
2. Generate or download models: **Meshy**, **Tripo** or **Hyper3D Rodin** (text/image to 3D), **Mixamo** (free rigging + walk/ride/dance animations for humanoids), **Sketchfab** (check each model's licence).
3. Export as **.glb** (glTF binary, Draco-compressed) into `public/models/`, then swap the procedural builders in `src/life/characters.js` / `src/life/mounts.js` for `GLTFLoader` loads, as `Horse.glb` already does.

## Roadmap

- More maps: Warangal Fort (Kakatiya kirti toranas), Brihadeeswara Temple in Thanjavur, Kanchipuram. Each new map should get its own `layout` + `fort`-style builder.
- Multiplayer: the simulation is already deterministic per seed, so other players can be synced as extra actors.
- Quests and characters with longer stories; horses and the Banjara traders' caravans.

## A note on history

The game is a loving reconstruction, not a survey. The layout follows the real fort loosely (the east-facing Fateh Darwaza, the clapping portico, the winding climb to the Bala Hisar durbar at the summit, the granite boulders), but many buildings visible at Golconda today are later Qutb Shahi work and are only suggested here.

[three.js]: https://threejs.org
[Poly Haven]: https://polyhaven.com
