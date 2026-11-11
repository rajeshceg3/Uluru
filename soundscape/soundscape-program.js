/* Uluru soundscape: the red centre, not its name. Cool dawn air with sparse
 * birds, hot wind and spinifex at midday, easing light with flock chatter,
 * cold night air with a distant dingo. Environmental only - no cultural
 * music, no voice, no field-recording claims. All synthesis. */

import {
  windNoise, whistleWind, rustle, birdChirps, insects, howls,
} from '../soundscape/soundscape-layers.js';

const S = 12, SEED = 5273;
const mk = (render, seconds = S) => ({ render, seconds });

export default {
  defaultScene: 'dawn',
  layers: {
    coolAir: mk((c) => windNoise(c, { color: 0.02, gustDepth: 0.3, base: 0.35, seed: SEED + 1 })),
    hotWind: mk((c) => windNoise(c, { color: 0.045, gustDepth: 0.75, gustRate: 0.12, base: 0.6, seed: SEED + 2 })),
    rockWhistle: mk((c) => whistleWind(c, { fMin: 300, fMax: 800, q: 8, gain: 0.14, seed: SEED + 3 })),
    spinifex: mk((c) => rustle(c, { gain: 0.24, period: 1.1, depth: 0.85, seed: SEED + 4 })),
    dawnBirds: mk((c) => birdChirps(c, { count: 7, fLo: 1600, fHi: 2900, gain: 0.26, seed: SEED + 5, minGap: 1.0, syllables: 2 })),
    cicadaShimmer: mk((c) => insects(c, { f: 5900, pulseHz: 9, gain: 0.035, seed: SEED + 6 })),
    flockChatter: mk((c) => birdChirps(c, { count: 14, fLo: 2400, fHi: 3800, durLo: 0.05, durHi: 0.12, trill: 22, gain: 0.16, seed: SEED + 7, minGap: 0.3 })),
    nightInsects: mk((c) => insects(c, { f: 4100, pulseHz: 21, gain: 0.04, seed: SEED + 8 })),
    dingo: mk((c) => howls(c, { count: 1, f0: 380, f1: 640, dur: 3.1, gain: 0.2, seed: SEED + 9 })),
  },
  scenes: {
    dawn: [
      { layer: 'coolAir', gain: 0.6 }, { layer: 'dawnBirds', gain: 0.7 },
      { layer: 'spinifex', gain: 0.2 },
    ],
    midday: [
      { layer: 'hotWind', gain: 0.7 }, { layer: 'rockWhistle', gain: 0.6 },
      { layer: 'spinifex', gain: 0.6 }, { layer: 'cicadaShimmer', gain: 0.7 },
    ],
    lastLight: [
      { layer: 'hotWind', gain: 0.35 }, { layer: 'flockChatter', gain: 0.7 },
      { layer: 'coolAir', gain: 0.4 },
    ],
    night: [
      { layer: 'coolAir', gain: 0.55 }, { layer: 'nightInsects', gain: 0.6 },
      { layer: 'dingo', gain: 0.55 },
    ],
  },
};
