// Room tiles at the 64 px minimum (#117): one finished tile for every room in the catalog (#36), drawn at
// 64 px per metre of the room's catalog size (a 4 x 3 m Bunk Room is 256 x 192 px).
//
// Every tile shares one template, the way the GDD's Art section asks ("shared room templates with tier trims"):
//   tier-trim beam (never restyled) / ceiling with conduits and lamps / back wall in the tier's material /
//   the room's own props standing on the floor / floor / side walls, then one lighting pass: the room falls into
//   shadow and each lamp throws a dithered cone, so props and walls share the same light (refs: bf67f06d5b, c002838c33).
// Survive rooms are steel, teal lab tile or concrete with hazard stencils; Comfort is walnut and plaster; Status is
// emerald silk with gold; Delusion is violet damask, marble and chandeliers.
//
//   renderRoomTile('bunk_room', { frame: 0 })  -> Raster (headless)   ROOM_TILE_IDS: every id with a tile
//   drawRoomTile(ctx, 'bunk_room', x, y, { frame, scale })            (browser; cached per id and frame)

import { Raster, col, K, box, hcyl, cone, glowAt, led, hash, bayer, text, textW, drawRaster } from './raster.js';
import { PROPS, WALL_PROPS, shadow } from './props.js';
import { GDD_ROOMS } from '../../catalog/rooms.js';
import { EXTRA_ROOMS, STOREROOM, EMPTY_ROOM } from '../../catalog/identify.js';

export const TILE_PX_PER_M = 64;
export const MIN_ART_PX = 64; // art note D4: nothing below 64 px

const TRIM_H = 8, CEIL_H = 18, FLOOR_H = 12, SIDE = 6;

// ------------------------------------------------------------------------------------------ the shell
const TRIMS = {
  survive: (b, W) => { for (let x = 0; x < W; x++) for (let y = 0; y < TRIM_H; y++) b.set(x, y, y === TRIM_H - 1 ? K : ((x + y) >> 3) % 2 ? K : col('hazard', y < 2 ? 5 : 4)); },
  comfort: (b, W) => { for (let x = 0; x < W; x++) for (let y = 0; y < TRIM_H; y++) b.set(x, y, y === TRIM_H - 1 ? col('walnut', 1) : col('walnut', 4 + (y < 2 ? 1 : 0) - (hash(x >> 2, y, 3) < 0.2 ? 1 : 0))); },
  status: (b, W) => { for (let x = 0; x < W; x++) for (let y = 0; y < TRIM_H; y++) b.set(x, y, y === 0 ? col('gold', 6) : y === TRIM_H - 1 ? col('gold', 1) : y >= 2 && y <= 5 && x % 12 >= 4 && x % 12 < 8 ? col('emerald', 4) : col('gold', 4)); },
  delusion: (b, W, frame) => { for (let x = 0; x < W; x++) for (let y = 0; y < TRIM_H; y++) b.set(x, y, y === TRIM_H - 1 ? col('violet', 1) : col('violet', 4 + ((x + y * 2 + frame * 3) % 9 === 0 ? 2 : (x >> 3) % 2))); },
};

/** Back-wall materials. Each paints rows y0..y1 (exclusive) across the inner width. */
const WALLS = {
  steel(b, x0, x1, y0, y1, s) {
    const ph = 48, pw = 64;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const px = (x - x0) % pw, py = (y - y0) % ph;
      let k = 3 + (hash(x >> 2, y >> 2, s) < 0.12 ? -1 : 0);
      if (py === 0) k = 1; else if (py === 1) k = 4; if (px === 0) k = 1; else if (px === 1) k = 4;
      if ((px === 5 || px === pw - 5) && (py === 5 || py === ph - 5)) k = 5;
      b.set(x, y, col('steel', k));
    }
    grime(b, x0, x1, y0, y1, s, 48);
  },
  lab(b, x0, x1, y0, y1, s) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const px = (x - x0) % 32, py = (y - y0) % 32;
      let k = 3 + (hash(x >> 3, y >> 3, s) < 0.2 ? 1 : 0);
      if (px === 0 || py === 0) k = 1; else if (px === 1 || py === 1) k = 5;
      b.set(x, y, col('teal', k));
    }
    for (let i = 0; i < (x1 - x0) / 40; i++) { // cracked panels, like the lab reference
      let cx = x0 + Math.floor(hash(i, s, 1) * (x1 - x0)), cy = y0 + 4;
      while (cy < y1 - 6) { b.set(cx, cy, col('teal', 0)); cy++; if (hash(cx, cy, s) < 0.3) cx += hash(cy, cx, 2) < 0.5 ? -1 : 1; if (hash(i, cy, 4) < 0.02) break; }
    }
    grime(b, x0, x1, y0, y1, s, 60);
  },
  concrete(b, x0, x1, y0, y1, s) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const py = (y - y0) % 24;
      let k = 3 + (hash(x >> 1, y >> 1, s) < 0.18 ? -1 : hash(x >> 1, y >> 1, s + 1) < 0.1 ? 1 : 0);
      if (py === 0) k = 2; if ((x - x0) % 96 === 0) k = 2; if (((x - x0) % 48 === 24) && ((y - y0) % 24 === 12)) k = 1; // tie holes
      b.set(x, y, col('concrete', k));
    }
    grime(b, x0, x1, y0, y1, s, 36);
  },
  tile(b, x0, x1, y0, y1, s) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const px = (x - x0) % 16, py = (y - y0) % 16;
      b.set(x, y, col('marble', px === 0 || py === 0 ? 3 : px === 1 || py === 1 ? 6 : 5 - (hash(x >> 4, y >> 4, s) < 0.15 ? 1 : 0)));
    }
    grime(b, x0, x1, y0, y1, s, 90);
  },
  comfort(b, x0, x1, y0, y1, s) {
    const dado = y1 - 52;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (y < dado) { const k = 4 + (hash(x >> 4, y >> 4, s) < 0.25 && hash(x >> 2, y >> 2, s + 1) < 0.6 ? -1 : 0) + ((x - x0) % 40 === 0 ? -1 : 0); b.set(x, y, col('plaster', k)); }
      else { const px = (x - x0) % 56; let k = 3 + (hash(x, y >> 2, s) < 0.25 ? -1 : 0); if (y === dado || y === dado + 1) k = y === dado ? 6 : 4; else if (px < 2 || px > 53 || y - dado < 6 || y1 - y < 6) k = px < 2 ? 2 : 4; b.set(x, y, col('walnut', k)); }
    }
  },
  status(b, x0, x1, y0, y1, s) {
    const dado = y1 - 44, pw = 80;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const px = (x - x0) % pw;
      if (y < dado) {
        let r = 'emerald', k = 3 + ((x + y) % 4 === 0 ? 1 : 0);
        if (px < 3 || px > pw - 4 || y - y0 < 3) { r = 'gold'; k = px === 0 || y === y0 ? 6 : 4; }
        else if (px < 10 || px > pw - 11) { k = 2; }
        b.set(x, y, col(r, k));
      } else b.set(x, y, y === dado ? col('gold', 6) : y === dado + 1 ? col('gold', 3) : col('walnut', 2 + ((x - x0) % 40 < 2 ? -1 : 0) + (y - dado === 3 ? 2 : 0)));
    }
  },
  delusion(b, x0, x1, y0, y1, s) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const px = (x - x0) % 24, py = (y - y0) % 32;
      const dx = Math.abs(px - 12), dy = Math.abs(py - 16);
      const motif = dx + dy * 0.75 < 9 && dx + dy * 0.75 > 6; // damask lozenges
      b.set(x, y, col('velvet', motif ? 4 : 2 + ((x + y) % 3 === 0 ? 1 : 0)));
    }
    for (let x = x0 + 40; x < x1 - 20; x += 128) { box(b, x, y0, 14, y1 - y0, 'gold', 4); b.rect(x + 3, y0, 2, y1 - y0, col('gold', 6)); }
  },
  garden(b, x0, x1, y0, y1, s) { // underground, so the sky is an LED ceiling faking daylight
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const t = (y - y0) / (y1 - y0); b.set(x, y, col('water', 6 - Math.floor(t * 2.2 + bayer(x, y) * 0.9)), 1); }
    for (let k = 0; k < (x1 - x0) / 120; k++) { const cx = x0 + 30 + k * 120 + Math.floor(hash(k, s) * 40), cy = y0 + 30 + Math.floor(hash(k, s, 2) * 40); for (let i = 0; i < 40; i++) for (let j = 0; j < 10; j++) if (Math.hypot((i - 20) / 20, (j - 5) / 5) < 1) b.set(cx + i, cy + j, col('water', 6), 1); }
    for (let x = x0; x < x1; x++) { const h = 30 + Math.round(Math.sin(x * 0.02 + s) * 12 + Math.sin(x * 0.07) * 5); b.rect(x, y1 - h, 1, h, col('leaf', 2 + (x % 7 === 0 ? 1 : 0))); }
  },
  surface(b, x0, x1, y0, y1, s) {
    for (let y = 0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const t = y / y1;
      b.set(x, y, col('violet', 1 + Math.floor(t * 3 + bayer(x, y) * 0.9)));
    }
    for (let i = 0; i < (x1 - x0) / 6; i++) { const sx = x0 + Math.floor(hash(i, s, 1) * (x1 - x0)), sy = Math.floor(hash(i, s, 2) * y1 * 0.6); b.set(sx, sy, col('plaster', 6), 1); }
    for (let x = x0; x < x1; x++) { const h = 10 + Math.round(Math.sin(x * 0.03 + s) * 6 + Math.sin(x * 0.11) * 3); b.rect(x, y1 - h, 1, h, col('violet', 2)); }
  },
};
/** Grime streaks running down from the top, in clusters (no single-pixel noise). */
function grime(b, x0, x1, y0, y1, s, every) {
  for (let i = 0; i < (x1 - x0) / every; i++) {
    const x = x0 + Math.floor(hash(i, s, 11) * (x1 - x0 - 4)); const len = 10 + Math.floor(hash(i, s, 12) * (y1 - y0) * 0.6);
    for (let j = 0; j < len; j++) { const w = j < len * 0.3 ? 3 : 2; for (let k = 0; k < w; k++) if (bayer(x + k, y0 + j) < 0.6 - j / len * 0.5) b.shift(x + k, y0 + j, -1); }
  }
}
const FLOORS = {
  grate: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y === fy ? col('steel', 6) : y === fy + 1 ? col('steel', 4) : col('steel', (x + (y - fy)) % 6 < 2 ? 1 : 3)); },
  concrete: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y === fy ? col('concrete', 5) : col('concrete', 3 - (hash(x >> 1, y, 4) < 0.2 ? 1 : 0) - (y > fy + 8 ? 1 : 0))); for (let x = x0; x < x1; x += 32) for (let y = fy + 2; y < H; y++) b.set(x, y, col('hazard', 3)); },
  tile: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, col('marble', y === fy ? 6 : (x >> 3) % 2 === ((y - fy) >> 2) % 2 ? 5 : 3)); },
  wood: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y === fy ? col('walnut', 6) : col('walnut', ((x + (y - fy) * 17) % 37 === 0) ? 2 : 4 - ((y - fy) % 4 === 3 ? 1 : 0) - (y > fy + 8 ? 1 : 0))); },
  marble: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) { const chk = ((x >> 4) + ((y - fy) >> 3)) % 2; b.set(x, y, y === fy ? col('gold', 5) : col(chk ? 'marble' : 'emerald', chk ? 5 : 3) ); } },
  gilded: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y === fy ? col('gold', 6) : (x - x0) % 48 < 2 ? col('gold', 4) : col('marble', 5 - ((x * 7 + y * 3) % 23 === 0 ? 2 : 0) - (y > fy + 8 ? 1 : 0))); },
  grass: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y < fy + 4 ? col('leaf', 4 + (hash(x, y, 2) < 0.3 ? 1 : 0)) : col('rust', 2 + (hash(x >> 1, y, 3) < 0.2 ? 1 : 0))); for (let x = x0; x < x1; x += 2) if (hash(x, 9) < 0.5) b.rect(x, fy - 3, 1, 3, col('leaf', 5)); },
  ground: (b, x0, x1, fy, H) => { for (let y = fy; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, y < fy + 3 ? col('leaf', 3 + (hash(x, y) < 0.3 ? 1 : 0)) : col('rust', 2 - (hash(x >> 1, y >> 1, 7) < 0.2 ? 1 : 0))); },
};
const STYLE = {
  steel: { wall: 'steel', floor: 'grate', lamp: 'strip', light: 'water' },
  lab: { wall: 'lab', floor: 'grate', lamp: 'strip', light: 'teal' },
  concrete: { wall: 'concrete', floor: 'concrete', lamp: 'sodium', light: 'amber' },
  tile: { wall: 'tile', floor: 'tile', lamp: 'strip', light: 'water' },
  comfort: { wall: 'comfort', floor: 'wood', lamp: 'pendant', light: 'amber' },
  status: { wall: 'status', floor: 'marble', lamp: 'sconce', light: 'gold' },
  delusion: { wall: 'delusion', floor: 'gilded', lamp: 'chandelier', light: 'gold' },
  surface: { wall: 'surface', floor: 'ground', lamp: 'none', light: 'amber' },
  garden: { wall: 'garden', floor: 'grass', lamp: 'none', light: 'leaf' },
};
const TIER_STYLE = { survive: 'steel', comfort: 'comfort', status: 'status', delusion: 'delusion' };

function ceiling(b, W, kind, sys) {
  const y0 = TRIM_H;
  if (kind === 'surface' || kind === 'garden') return;
  const r = kind === 'comfort' ? 'plaster' : kind === 'status' ? 'walnut' : kind === 'delusion' ? 'velvet' : 'steel';
  for (let y = y0; y < y0 + CEIL_H; y++) for (let x = 0; x < W; x++) b.set(x, y, col(r, (y === y0 + CEIL_H - 1 ? 4 : 1) + ((x >> 4) % 2 && y < y0 + 4 ? 1 : 0)));
  if (kind === 'steel' || kind === 'lab' || kind === 'concrete' || kind === 'tile') {
    // the bunker's conduits run overhead in their system colours: air (blue), water (teal), power (yellow)
    const runs = [['water', 4, y0 + 3], ['leaf', 4, y0 + 9]].concat(sys ? [] : []);
    hcyl(b, 0, y0 + 2, W, 5, 'water', 3, { outline: false });
    hcyl(b, 0, y0 + 9, W, 4, 'teal', 4, { outline: false });
    b.rect(0, y0 + 14, W, 2, col('hazard', 3));
    for (let x = 20; x < W; x += 64) box(b, x, y0 + 1, 4, 15, 'steel', 2, { outline: false });
    void runs;
  } else if (kind === 'status' || kind === 'delusion') {
    for (let x = 0; x < W; x += 32) { b.rect(x, y0, 2, CEIL_H, col('gold', 3)); }
    b.rect(0, y0 + CEIL_H - 3, W, 2, col('gold', 5));
  } else {
    b.rect(0, y0 + CEIL_H - 4, W, 3, col('plaster', 5)); b.rect(0, y0 + CEIL_H - 1, W, 1, col('plaster', 2));
  }
}
function lampFixture(b, x, kind, frame) {
  const y = TRIM_H + CEIL_H;
  if (kind === 'strip') { b.rect(x - 16, y - 3, 32, 3, K); b.rect(x - 15, y - 2, 30, 2, col('plaster', 6), 1); }
  else if (kind === 'sodium') { box(b, x - 8, y - 4, 16, 4, 'steel', 2); b.rect(x - 6, y, 12, 2, col('amber', 6), 1); }
  else if (kind === 'pendant') { b.rect(x, y - 2, 1, 12, K); box(b, x - 8, y + 10, 17, 7, 'gold', 3); b.rect(x - 5, y + 17, 11, 2, col('amber', 6), 1); }
  else if (kind === 'sconce') { box(b, x - 3, y + 26, 7, 10, 'gold', 4); b.rect(x - 5, y + 20, 11, 6, col('amber', 6), 1); glowAt(b, x, y + 23, 16, 1.4); }
  else if (kind === 'chandelier') {
    b.rect(x, y - 2, 1, 8, col('gold', 4)); box(b, x - 22, y + 6, 45, 3, 'gold', 4);
    for (let i = -20; i <= 20; i += 8) { b.rect(x + i, y + 9, 2, 8, col('water', 6), 1); b.set(x + i, y + 17 + ((i / 8 + frame) % 2), col('amber', 6), 1); }
    glowAt(b, x, y + 12, 30, 1.6);
  }
}

/** Room name stencilled (survive) or on a brass plaque (others). */
function signage(b, W, wallTop, style, label, tier) {
  if (!label) return;
  const s = style === 'surface' || style === 'garden' ? null : style;
  if (!s) return;
  if (tier === 'survive' && s !== 'comfort') {
    const scale = textW(label, 3) <= W - 40 ? 3 : textW(label, 2) <= W - 30 ? 2 : textW(label, 1) <= W - 20 ? 1 : 0;
    if (!scale) return;
    text(b, label, SIDE + 10, wallTop + 8, col(s === 'lab' ? 'teal' : s === 'concrete' ? 'concrete' : s === 'tile' ? 'marble' : 'steel', 0), scale, { worn: 0.12 });
    if (W >= 160) for (let x = SIDE + 10; x < Math.min(W - SIDE - 10, SIDE + 10 + textW(label, scale)); x++) for (let j = 0; j < 4; j++) b.set(x, wallTop + 8 + 5 * scale + 4 + j, ((x + j) >> 2) % 2 ? K : col('hazard', 3));
  } else {
    const tw = textW(label, 1); if (tw + 12 > W - 2 * SIDE) return;
    const px = SIDE + 14;
    box(b, px, wallTop + 28, tw + 10, 11, 'gold', 4); text(b, label, px + 5, wallTop + 31, col('gold', 1), 1);
  }
}

// ------------------------------------------------------------------------------------------ what each room holds
// floor: props left to right (spread evenly); wall: [prop, x as a 0..1 fraction of the width, y offset from the wall
// top]; style overrides the tier's shell; label = stencil/plaque text (defaults to the room name).
const SPEC = {
  airlock: { style: 'steel', floor: ['decon'], wall: [['hazardSign', 0.8, 30]], extra: airlockDoor },
  bunk_room: { floor: ['bunk', 'bunk'], wall: [['vent', 0.5, 6]], label: 'BUNKS' },
  pantry: { floor: ['shelf', 'crates', 'fridge'] },
  water_tank: { floor: ['tank', 'drum'], wall: [['dial', 0.85, 30]] },
  diesel_generator: { style: 'concrete', floor: ['generator', 'drum'], label: 'GENERATOR' },
  hand_crank_scrubber: { floor: ['crank'], label: 'AIR' },
  blast_door_1: { fixture: 'blast', mk: 1 }, blast_door_2: { fixture: 'blast', mk: 2 }, blast_door_3: { fixture: 'blast', mk: 3 },
  utility_spine: { fixture: 'spine' },
  sump_pump: { style: 'concrete', floor: ['sump'], label: 'SUMP' },
  med_bay: { style: 'tile', floor: ['medbed', 'medkit'], label: 'MED BAY' },
  decon_shower: { style: 'tile', floor: ['decon'], label: 'DECON' },
  hepa_scrubber_bay: { floor: ['hepa', 'drum'], wall: [['vent', 0.82, 8]], label: 'HEPA' },
  battery_bank: { floor: ['battery', 'battery', 'battery'], label: 'POWER' },
  solar_mast: { style: 'surface', floor: ['solar'] },
  hydroponics_bay: { style: 'lab', floor: ['growrack', 'growrack', 'growrack'], label: 'HYDRO 01' },
  flood_seals: { fixture: 'flood' },
  faraday_room: { style: 'steel', floor: ['servers', 'tapes'], extra: faradayMesh, label: 'FARADAY' },
  geothermal_plant: { style: 'concrete', floor: ['geothermal', 'boiler'], label: 'GEOTHERMAL' },
  deep_water_recycler: { floor: ['recycler', 'tank'], label: 'RECYCLER' },
  aquaponics_bay: { style: 'lab', floor: ['fishtank', 'growrack', 'growrack'], label: 'AQUAPONICS' },
  protein_vats: { style: 'lab', floor: ['vat', 'vat', 'vat'], label: 'PROTEIN' },
  seed_vault: { style: 'concrete', floor: ['seedlocker', 'seedlocker'], label: 'SEEDS' },
  security_post: { style: 'surface', floor: ['guardpost', 'camera'], extra: surfaceHut },
  decoy_entrance: { style: 'surface', floor: [], extra: decoyHatch },
  armory: { style: 'concrete', floor: ['gunlocker', 'crates'], wall: [['rifle', 0.72, 30], ['rifle', 0.72, 56]], label: 'ARMORY' },
  aquifer_well: { style: 'concrete', floor: ['sump'], extra: wellShaft, label: 'WELL' },
  micro_reactor: { style: 'concrete', floor: ['reactor'], wall: [['hazardSign', 0.08, 40], ['hazardSign', 0.92, 40]], label: '' },
  galley_kitchen: { floor: ['stove', 'fridge'], wall: [['shelfWall', 0.2, 40]] },
  master_suite: { floor: ['kingbed', 'armchair'], wall: [['painting', 0.78, 24]], accent: 'velvet' },
  lounge: { floor: ['sofa', 'tv', 'plant'], wall: [['painting', 0.3, 20]] },
  window_wall: { floor: ['armchair', 'plant'], wall: [['ledsky', 0.5, 14]], label: '' },
  laundry: { floor: ['washer'], wall: [['shelfWall', 0.5, 30]], label: '' },
  gym: { floor: ['gymrig', 'treadmill'], wall: [['mirror', 0.85, 20]] },
  guest_quarters: { floor: ['bed', 'plant'], wall: [['painting', 0.4, 26]], accent: 'water' },
  library_game_room: { floor: ['bookshelf', 'pooltable', 'bookshelf'], label: 'LIBRARY' },
  therapy_pod: { floor: ['armchair', 'plant'], wall: [['painting', 0.5, 30]], label: '', accent: 'leaf' },
  atrium_garden: { style: 'garden', floor: ['tree', 'bench', 'plant', 'tree'], extra: atriumGlass },
  wine_cellar: { floor: ['winerack', 'barrel', 'winerack'], label: 'CELLAR' },
  home_cinema: { floor: ['cinemaseats'], wall: [['bigscreen', 0.5, 8]], label: '' },
  biohacking_lab: { style: 'lab', floor: ['labbench', 'clonetube'], label: 'BIOHACK' },
  broadcast_studio: { floor: ['desk', 'camera', 'mic'], wall: [['onair', 0.75, 14], ['map', 0.25, 14]], label: '' },
  panic_room: { style: 'steel', floor: ['guardpost'], extra: vaultDoor, label: 'PANIC' },
  chefs_kitchen: { floor: ['range', 'fridge'], wall: [['shelfWall', 0.3, 34]] },
  art_vault: { floor: ['statue', 'pedestal', 'statue'], wall: [['painting', 0.25, 20], ['portrait', 0.6, 8], ['painting', 0.85, 24]] },
  heir_nursery: { floor: ['crib', 'plant'], wall: [['portrait', 0.75, 10]], accent: 'water' },
  trophy_garage: { style: 'concrete', floor: ['car'], extra: liftDoor, label: 'GARAGE', accent: 'gold' },
  helipad: { style: 'surface', floor: ['helicopter'], extra: helipadMarks },
  cigar_lounge: { floor: ['armchair', 'table', 'armchair'], extra: smoke, label: 'CIGARS' },
  spa_sauna: { style: 'tile', floor: ['bench', 'plant'], extra: spaPool, label: 'SPA' },
  infinity_pool: { style: 'tile', floor: ['plant', 'bench'], extra: infinityPool, label: '' },
  museum_of_me: { floor: ['statue', 'pedestal', 'pedestal', 'statue'], wall: [['portrait', 0.2, 8], ['portrait', 0.5, 4], ['portrait', 0.8, 8]] },
  personal_mausoleum: { floor: ['sarcophagus'], wall: [['portrait', 0.5, 4]] },
  throne_room: { floor: ['throne'], wall: [['portrait', 0.12, 20], ['portrait', 0.88, 20]] },
  mansion_replica_floor: { floor: ['grandstair', 'piano', 'sofa', 'column', 'statue'], wall: [['portrait', 0.55, 30], ['painting', 0.72, 40], ['mirror', 0.9, 30]], extra: mansionUpper },
  private_forest_dome: { style: 'garden', floor: ['tree', 'tree', 'bench', 'tree', 'tree'], extra: domeRibs },
  pet_clone_lab: { style: 'lab', floor: ['clonetube', 'clonetube', 'clonetube', 'labbench'], label: 'CLONE LAB' },
  legacy_broadcast_array: { style: 'surface', floor: ['console', 'radiomast'] },
  cryo_pod_bay: { floor: ['cryopod', 'cryopod', 'cryopod', 'cryopod'], label: '', lamp: 'strip' },
  genetic_library: { style: 'lab', floor: ['vials', 'vials', 'labbench'], label: 'GENOME' },
  ceramic_lining: { fixture: 'lining' },
  emp_room: { style: 'steel', floor: ['emp'], label: 'EMP' },
  thermal_cladding: { fixture: 'cladding' },
  boiler_room: { style: 'concrete', floor: ['boiler', 'drum'], label: 'BOILER' },
  debris_cap: { fixture: 'debris' },
  radio_room: { style: 'steel', floor: ['console', 'mic'], wall: [['map', 0.7, 10]], label: 'RADIO' },
  condenser: { style: 'steel', floor: ['condenser'], label: 'WATER' },
  water_vault: { style: 'concrete', floor: ['tanks', 'tank'], label: 'WATER VAULT' },
  kiln_workshop: { style: 'concrete', floor: ['kiln', 'crates'], label: 'KILN' },
  fuel_depot: { style: 'concrete', floor: ['drums', 'drums'], wall: [['hazardSign', 0.8, 30]], label: 'FUEL' },
  convoy_bay: { style: 'concrete', floor: ['truck', 'drum'], extra: liftDoor, label: 'CONVOY' },
  cloud_embassy: { style: 'surface', floor: ['desk', 'plant'], extra: surfaceHut },
  washroom: { style: 'tile', floor: ['toilet', 'sink', 'shower'], wall: [['mirror', 0.4, 10]], label: '' },
  storeroom: { floor: ['crates', 'shelf'], label: 'STORES' },
  empty: { floor: [], label: '' },
};

// ------------------------------------------------------------------------------------------ room extras
function airlockDoor(b, W, H, fy, o) { const x = W - 76; box(b, x, fy - 150, 60, 150, 'steel', 3); b.rect(x + 4, fy - 146, 52, 4, col('hazard', 4)); box(b, x + 16, fy - 120, 28, 28, 'water', 3); for (let t = 0; t < 6.28; t += 0.05) b.set(Math.round(x + 30 + Math.cos(t) * 10), Math.round(fy - 60 + Math.sin(t) * 10), col('steel', 6)); text(b, 'SEAL', x + 15, fy - 40, col('hazard', 4), 2); }
function vaultDoor(b, W, H, fy, o) { const cx = W - 80, cy = fy - 76; for (let j = -60; j <= 60; j++) for (let i = -60; i <= 60; i++) { const d = Math.hypot(i, j); if (d <= 60) b.set(cx + i, cy + j, d > 58 ? K : col('steel', d > 50 ? 3 : 4 + (i < -j ? 1 : 0))); } for (let k = 0; k < 6; k++) { const a = k * 1.047 + (o.frame ? 0.2 : 0); for (let r = 0; r < 26; r++) b.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), col('steel', 6)); } box(b, cx - 6, cy - 6, 12, 12, 'gold', 4); }
function faradayMesh(b, W, H, fy) { for (let y = TRIM_H + CEIL_H; y < fy; y++) for (let x = SIDE; x < W - SIDE; x++) if ((x % 8 === 0 || y % 8 === 0) && bayer(x, y) < 0.7) b.set(x, y, col('rust', 4)); }
function wellShaft(b, W, H, fy, o) { const x = W - 52; box(b, x, fy - 150, 36, 150, 'steel', 1); for (let y = fy - 146; y < fy; y++) b.rect(x + 14, y, 8, 1, col('water', 3 + ((y + o.frame * 4) % 8 < 2 ? 2 : 0)), 1); text(b, '80M', x + 4, fy - 140, col('hazard', 4), 2); }
function liftDoor(b, W, H, fy) { const x = W - 120; box(b, x, fy - 150, 104, 150, 'steel', 2); for (let y = fy - 146; y < fy; y += 8) b.rect(x + 2, y, 100, 2, col('steel', 4)); for (let i = 0; i < 104; i += 16) b.rect(x + i, fy - 158, 8, 8, col('hazard', 4)); }
function smoke(b, W, H, fy, o) { for (let i = 0; i < 40; i++) { const x = Math.floor(W * 0.5 + Math.sin(i * 0.5 + o.frame) * 30 + (hash(i, 1) - 0.5) * 60), y = fy - 70 - i * 2; b.shade(x, y, 6, 3, 0.6); } }
function spaPool(b, W, H, fy, o) { const x0 = Math.floor(W * 0.45), x1 = W - SIDE - 8; for (let y = fy - 2; y < H - 2; y++) for (let x = x0; x < x1; x++) b.set(x, y, col('water', 4 + ((x + y + o.frame * 2) % 11 === 0 ? 2 : 0)), 1); b.rect(x0 - 2, fy - 4, x1 - x0 + 4, 2, col('marble', 6)); for (let i = 0; i < 12; i++) b.shade(x0 + Math.floor(hash(i, 2) * (x1 - x0)), fy - 20 - (i * 7) % 40, 8, 3, 0.7); }
function infinityPool(b, W, H, fy, o) { const x0 = 140, x1 = W - SIDE; for (let y = fy - 8; y < H; y++) for (let x = x0; x < x1; x++) b.set(x, y, col('water', (y < fy - 6 ? 6 : 4) + ((x * 3 + y * 5 + o.frame * 7) % 19 === 0 ? 1 : 0)), 1); box(b, x0 - 6, fy - 10, 6, H - fy + 10, 'marble', 5); WALL_PROPS.ledsky.draw(b, Math.floor((x0 + x1) / 2) - 112, TRIM_H + CEIL_H + 20, o); }
function atriumGlass(b, W, H, fy) { for (let x = SIDE; x < W - SIDE; x += 48) b.rect(x, TRIM_H, 3, fy - TRIM_H - 120, col('steel', 3)); for (let y = TRIM_H + 40; y < fy - 120; y += 48) b.rect(SIDE, y, W - 2 * SIDE, 3, col('steel', 3)); }
function domeRibs(b, W, H, fy) { const cx = W / 2, r = W / 2 - SIDE; for (let k = -6; k <= 6; k++) { const a = (k / 7) * (Math.PI / 2); for (let t = 0; t < 1; t += 0.002) { const x = Math.round(cx + Math.sin(a) * r * t * 1.0); const y = Math.round(fy - Math.cos(a * t) * (fy - TRIM_H) * 0.98 + (1 - t) * 0); void x; void y; } } for (let t = 0; t < Math.PI; t += 0.003) { const x = Math.round(cx - Math.cos(t) * r), y = Math.round(fy - Math.sin(t) * (fy - TRIM_H - 6)); b.rect(x, y, 3, 3, col('steel', 4)); } for (let k = 1; k < 8; k++) { const x0 = Math.round(cx - r + (2 * r * k) / 8); const h = Math.round(Math.sqrt(Math.max(0, r * r - (x0 - cx) ** 2)) / r * (fy - TRIM_H - 6)); b.rect(x0, fy - h, 2, h, col('steel', 3)); } }
function mansionUpper(b, W, H, fy) { const mid = Math.floor((TRIM_H + CEIL_H + fy) / 2) - 20; box(b, SIDE, mid, W * 0.42, 10, 'marble', 5); for (let x = SIDE + 6; x < W * 0.42; x += 10) box(b, x, mid - 30, 3, 30, 'gold', 4); box(b, SIDE, mid - 34, W * 0.42, 4, 'gold', 5); for (let k = 0; k < 3; k++) lampFixture(b, Math.floor(W * (0.3 + k * 0.25)), 'chandelier', 0); }
function surfaceHut(b, W, H, fy) { box(b, SIDE + 4, fy - 96, W - 2 * SIDE - 8, 96, 'concrete', 3); box(b, SIDE, fy - 104, W - 2 * SIDE, 10, 'concrete', 5); for (let x = SIDE + 20; x < W - SIDE - 30; x += 60) { box(b, x, fy - 84, 30, 20, 'water', 4); b.rect(x + 2, fy - 82, 26, 2, col('water', 6), 1); } }
function decoyHatch(b, W, H, fy, o) { box(b, W / 2 - 50, fy - 40, 100, 40, 'concrete', 3); box(b, W / 2 - 40, fy - 56, 80, 18, 'steel', 3); for (let i = 0; i < 80; i += 16) b.rect(W / 2 - 40 + i, fy - 56, 8, 4, col('hazard', 4)); text(b, 'NO ENTRY', W / 2 - 31, fy - 28, col('red', 4), 2, { worn: 0.2 }); led(b, W / 2 + 30, fy - 52, 'red', o.frame, true, 3); }
function helipadMarks(b, W, H, fy) { box(b, SIDE, fy - 6, W - 2 * SIDE, 6, 'concrete', 4); for (let x = SIDE + 10; x < W - SIDE - 10; x += 20) b.rect(x, fy - 5, 10, 2, col('hazard', 5)); }

// ------------------------------------------------------------------------------------------ fixtures
function drawFixture(b, W, H, spec, o) {
  const fy = H - FLOOR_H;
  if (spec.fixture === 'debris') {
    WALLS.surface(b, 0, W, 0, fy, 5); FLOORS.ground(b, 0, W, fy, H);
    const cx = W / 2; for (let y = 0; y < 70; y++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - (y / 70) ** 2)) * (W / 2 - 8)); b.rect(cx - half, fy - y, half * 2, 1, col('concrete', y > 60 ? 5 : 3 + (bayer(cx + half, y) < 0.3 ? 1 : 0))); }
    for (let k = 0; k < 6; k++) b.rect(cx - 40 + k * 14, fy - 54 + (k % 2) * 8, 6, 4, col('concrete', 1)); return;
  }
  WALLS[spec.fixture === 'spine' ? 'concrete' : 'steel'](b, 0, W, TRIM_H, fy, 3); TRIMS.survive(b, W); FLOORS.grate(b, 0, W, fy, H);
  if (spec.fixture === 'blast') {
    const x = 4, w = W - 8; box(b, x, TRIM_H + 10, w, fy - TRIM_H - 10, 'steel', 3); rivets(b, x, TRIM_H + 10, w, fy - TRIM_H - 10);
    for (let k = 0; k < spec.mk; k++) { const y = TRIM_H + 30 + k * 40; for (let i = 0; i < w - 4; i++) for (let j = 0; j < 12; j++) b.set(x + 2 + i, y + j, ((i + j) >> 3) % 2 ? K : col('hazard', 4)); }
    const cy = fy - 50; for (let t = 0; t < 6.28; t += 0.04) for (let r = 15; r < 18; r++) b.set(Math.round(W / 2 + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), col('steel', 6)); for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.4; for (let r = 0; r < 16; r++) b.set(Math.round(W / 2 + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), col('steel', 6)); }
    text(b, `MK${'I'.repeat(spec.mk)}`, 10, fy - 20, col('hazard', 5), 2);
  } else if (spec.fixture === 'spine') {
    for (const px of [10, W - 26]) for (let y = TRIM_H; y < fy; y += 4) b.rect(px, y, 16, 1, col('steel', 4));
    box(b, 30, fy - 140, W - 60, 140, 'steel', 2); for (let y = fy - 136; y < fy; y += 10) b.rect(32, y, W - 64, 1, col('steel', 4)); box(b, 40, fy - 60, W - 80, 56, 'hazard', 3);
    hcyl(b, 0, TRIM_H + 4, W, 6, 'water', 3); for (const [px, r] of [[4, 'water'], [W - 10, 'hazard']]) box(b, px, TRIM_H, 6, fy - TRIM_H, r, 3, { outline: false });
  } else if (spec.fixture === 'lining') {
    for (let y = TRIM_H; y < fy; y++) for (let x = 0; x < W; x++) { const row = Math.floor((y - TRIM_H) / 14); const px = (x + (row % 2) * 12) % 24, py = (y - TRIM_H) % 14; b.set(x, y, col('marble', px === 0 || py === 0 ? 2 : py < 3 ? 6 : 5)); }
    text(b, 'CERAMIC', 10, TRIM_H + 16, col('marble', 1), 2);
  } else if (spec.fixture === 'cladding') {
    for (let y = TRIM_H; y < fy; y++) for (let x = 0; x < W; x++) { const px = (x % 32) - 16, py = ((y - TRIM_H) % 32) - 16; const d = Math.abs(px) + Math.abs(py); b.set(x, y, col('steel', d > 14 ? 3 : 7 - Math.floor(d / 4) - (x % 32 < 16 ? 0 : 1))); }
    text(b, 'THERMAL', 10, TRIM_H + 16, col('red', 4), 2);
  } else if (spec.fixture === 'flood') {
    box(b, 16, TRIM_H + 14, W - 32, fy - TRIM_H - 30, 'steel', 3); for (let y = TRIM_H + 18; y < fy - 20; y += 6) b.rect(18, y, W - 36, 3, col('steel', 4));
    box(b, 8, fy - 16, W - 16, 16, 'cloth', 1); for (let x = 12; x < W - 12; x += 10) b.rect(x, fy - 12, 6, 6, col('cloth', 3)); text(b, 'FLOOD', 22, TRIM_H + 22, col('hazard', 5), 2);
  }
  light(b, W, H, fy, [W / 2], 'strip', o.frame);
}
function rivets(b, x, y, w, h) { for (let i = 6; i < w - 4; i += 12) { b.set(x + i, y + 4, col('steel', 6)); b.set(x + i, y + h - 5, col('steel', 6)); } }

// ------------------------------------------------------------------------------------------ lighting
function light(b, W, H, fy, lamps, kind, frame) {
  const top = TRIM_H + CEIL_H;
  // ambient: the room sinks into shadow, darker toward the corners
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) {
    const ex = Math.min(x, W - 1 - x) / Math.max(1, Math.min(90, W / 2)); // 0 at the side walls
    const a = 1 + (ex < 1 ? (1 - ex) * 0.9 : 0);
    const d = Math.floor(a) + (bayer(x, y) < a - Math.floor(a) ? 1 : 0);
    if (d) b.shift(x, y, -d);
  }
  if (kind !== 'none') for (const lx of lamps) cone(b, Math.round(lx), top, fy + FLOOR_H, kind === 'sconce' ? 10 : 8, kind === 'chandelier' ? 90 : 56, kind === 'chandelier' ? 2 : 1.7);
  for (const lx of lamps) lampFixture(b, Math.round(lx), kind, frame);
  // the side walls: structure in front of the room
  for (let y = TRIM_H; y < H; y++) for (let i = 0; i < SIDE; i++) { b.set(i, y, i === SIDE - 1 ? K : col('steel', 1)); b.set(W - 1 - i, y, i === SIDE - 1 ? K : col('steel', 1)); }
}

// ------------------------------------------------------------------------------------------ public API
const ROOM_LIST = [...GDD_ROOMS, ...EXTRA_ROOMS, STOREROOM, EMPTY_ROOM];
const ROOM_BY_ID = Object.fromEntries(ROOM_LIST.map((r) => [r.id, r]));
export const ROOM_TILE_IDS = Object.freeze(ROOM_LIST.map((r) => r.id).filter((id) => SPEC[id]));

/** Tile size in metres: the catalog size; fixtures without one are 2 x 3; the spine shows one 2 x 3 floor. */
export function roomTileSize(id) {
  const r = ROOM_BY_ID[id];
  const s = r?.size ?? {};
  let w = s.w ?? r?.minW ?? 2, h = s.h ?? 3;
  if (id === 'storeroom' || id === 'empty') { w = 3; h = 3; }
  if (id === 'washroom') { w = 3; h = 3; }
  if (s.surface && h < 2) h = 2; // the helipad: room for the sky above the pad
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/** Paint one room tile into a new Raster (headless). */
export function renderRoomTile(id, { frame = 0 } = {}) {
  const spec = SPEC[id];
  if (!spec) throw new Error(`no room tile for ${id}`);
  const room = ROOM_BY_ID[id];
  const { w, h } = roomTileSize(id);
  const W = w * TILE_PX_PER_M, H = h * TILE_PX_PER_M;
  const b = new Raster(W, H);
  const o = { frame: frame % 2, accent: spec.accent, seed: id.length };
  if (spec.fixture) { drawFixture(b, W, H, spec, o); return b; }
  const tier = room?.tier ?? 'survive';
  const styleName = spec.style ?? TIER_STYLE[tier];
  const st = STYLE[styleName];
  const fy = H - FLOOR_H, wallTop = TRIM_H + CEIL_H;
  const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  WALLS[st.wall](b, 0, W, styleName === 'surface' || styleName === 'garden' ? 0 : wallTop, fy, seed);
  ceiling(b, W, styleName);
  (TRIMS[tier] ?? TRIMS.survive)(b, W, o.frame);
  FLOORS[st.floor](b, 0, W, fy, H);
  signage(b, W, wallTop, styleName, spec.label ?? (room?.name ?? id).toUpperCase(), tier);
  for (const [name, fx, dy] of spec.wall ?? []) { const p = WALL_PROPS[name]; const x = Math.round(fx * W - p.w / 2); p.draw(b, Math.max(SIDE + 2, Math.min(W - SIDE - 2 - p.w, x)), wallTop + dy, o); }
  if (spec.extra) spec.extra(b, W, H, fy, o);
  layout(b, spec.floor ?? [], W, fy, o, spec.extra === airlockDoor || spec.extra === vaultDoor || spec.extra === wellShaft || spec.extra === liftDoor ? 130 : 0, spec.extra === infinityPool ? W - 150 : 0);
  const lampKind = spec.lamp ?? st.lamp;
  const n = Math.max(1, Math.round(W / 140));
  const lamps = Array.from({ length: n }, (_, i) => (W * (i + 0.5)) / n);
  light(b, W, H, fy, lamps, lampKind, o.frame);
  return b;
}

/** Spread floor props across the room, leaving `reserveRight` px free (for a door) or `reserveRightPool`. */
function layout(b, names, W, fy, o, reserveRight = 0, reserveRightPool = 0) {
  const props = names.map((n) => PROPS[n]).filter(Boolean);
  const x0 = SIDE + 4, x1 = W - SIDE - 4 - Math.max(reserveRight, reserveRightPool);
  let total = props.reduce((s, p) => s + p.w, 0);
  while (props.length && total > x1 - x0) { total -= props.pop().w; }
  if (!props.length) return;
  const gap = props.length > 1 ? Math.min(48, (x1 - x0 - total) / (props.length - 1)) : 0;
  let x = x0 + Math.max(0, (x1 - x0 - total - gap * (props.length - 1)) / 2);
  props.forEach((p, i) => { p.draw(b, Math.round(x), fy, { ...o, seed: i }); x += p.w + gap; });
}

const tileCache = new Map();
/** Draw a room tile on a canvas (browser). `scale` must be a whole number. */
export function drawRoomTile(ctx, id, x, y, { frame = 0, scale = 1 } = {}) {
  const key = `${id}:${frame % 2}`;
  let cv = tileCache.get(key);
  if (!cv) {
    const r = renderRoomTile(id, { frame });
    cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h;
    drawRaster(cv.getContext('2d'), r, 0, 0);
    tileCache.set(key, cv);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, x, y, cv.width * scale, cv.height * scale);
  return cv;
}
export { shadow };
