// A seeded RNG whose position can be saved and restored (#80): the same mulberry32 every system used,
// with `rng.state` readable and writable so a resumed campaign rolls exactly the dice it would have.
//   const rng = seededRng(42); rng(); const s = rng.state; ... rng.state = s;
export function seededRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(rng, 'state', { get: () => a, set: (v) => { a = v >>> 0; }, enumerable: true });
  return rng;
}
