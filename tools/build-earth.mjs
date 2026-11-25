#!/usr/bin/env node
// Builds src/art/earth-data.js (#138): the real Earth's land, split into the game's eight demand regions, as a
// compact region raster the map painter reads. Run once; the result is committed (the game has no build step).
//
//   mkdir /tmp/geo && (cd /tmp/geo && npm i world-atlas@2.0.2 topojson-client@3.1.0)
//   node tools/build-earth.mjs /tmp/geo/node_modules
//
// Source: Natural Earth 1:50m countries via world-atlas (public domain data, ISC package).
// Projection: Miller cylindrical, 84N to 78S, cut in the Pacific at 169.5W so no continent is split. That window
// is exactly the map's 5:3 shape. Each country goes to one region; Russia splits at 60E (Europe / E.Asia);
// Greenland and Antarctica are ice.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mods = process.argv[2];
if (!mods) { console.error('usage: node tools/build-earth.mjs <node_modules with world-atlas and topojson-client>'); process.exit(1); }
const { feature } = await import(pathToFileURL(join(mods, 'topojson-client/dist/topojson-client.js')).href).catch(() => import(pathToFileURL(join(mods, 'topojson-client/src/index.js')).href));
const topo = JSON.parse(readFileSync(join(mods, 'world-atlas/countries-50m.json'), 'utf8'));
const countries = feature(topo, topo.objects.countries).features;

export const W = 1280, H = 768;
export const LON0 = -169.5, LAT_TOP = 84, LAT_BOTTOM = -78;
const miller = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * (lat * Math.PI / 180)));
const Y0 = miller(LAT_TOP), Y1 = miller(LAT_BOTTOM);
const px = (lon) => ((((lon - LON0) % 360) + 360) % 360) / 360 * W;
const py = (lat) => (Y0 - miller(Math.max(-89.9, Math.min(89.9, lat)))) / (Y0 - Y1) * H;

const REGIONS = ['nam', 'lat', 'eur', 'afr', 'mea', 'sas', 'eas', 'oce', 'ice'];
const LISTS = {
  nam: ['United States of America', 'Canada', 'Bermuda', 'St. Pierre and Miquelon'],
  lat: ['Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Haiti', 'Dominican Rep.', 'Jamaica', 'Puerto Rico', 'Bahamas', 'Trinidad and Tobago', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'Ecuador', 'Peru', 'Brazil', 'Bolivia', 'Paraguay', 'Uruguay', 'Argentina', 'Chile', 'Falkland Is.', 'S. Geo. and the Is.', 'Barbados', 'St. Lucia', 'Grenada', 'St. Vin. and Gren.', 'Antigua and Barb.', 'Dominica', 'St. Kitts and Nevis', 'Curaçao', 'Aruba', 'Turks and Caicos Is.', 'Cayman Is.', 'British Virgin Is.', 'U.S. Virgin Is.', 'Anguilla', 'Montserrat', 'Sint Maarten', 'St-Martin', 'St-Barthélemy'],
  mea: ['Turkey', 'Syria', 'Lebanon', 'Israel', 'Palestine', 'Jordan', 'Iraq', 'Iran', 'Saudi Arabia', 'Kuwait', 'Bahrain', 'Qatar', 'United Arab Emirates', 'Oman', 'Yemen', 'Egypt', 'Cyprus', 'N. Cyprus', 'Georgia', 'Armenia', 'Azerbaijan'],
  sas: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Afghanistan', 'Maldives', 'Myanmar', 'Thailand', 'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Singapore', 'Indonesia', 'Philippines', 'Brunei', 'Timor-Leste', 'Indian Ocean Ter.', 'Br. Indian Ocean Ter.'],
  eas: ['China', 'Mongolia', 'North Korea', 'South Korea', 'Japan', 'Taiwan', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Hong Kong', 'Macao'],
  oce: ['Australia', 'New Zealand', 'Papua New Guinea', 'Solomon Is.', 'Vanuatu', 'Fiji', 'New Caledonia', 'Samoa', 'Tonga', 'Kiribati', 'Micronesia', 'Palau', 'Marshall Is.', 'Nauru', 'Tuvalu', 'Fr. Polynesia', 'Cook Is.', 'Niue', 'American Samoa', 'Guam', 'N. Mariana Is.', 'Wallis and Futuna', 'Norfolk Island', 'Pitcairn Is.', 'Heard I. and McDonald Is.', 'Ashmore and Cartier Is.'],
  ice: ['Greenland', 'Antarctica', 'Fr. S. Antarctic Lands'],
};
const AFRICA_HINT = (lon, lat) => lat < 37.5 && lat > -36 && lon > -26 && lon < 52;
function regionOf(name, lon, lat) {
  if (name === 'Russia') return 'russia'; // split per pixel below, at the Urals (60E)
  for (const [r, list] of Object.entries(LISTS)) if (list.includes(name)) return r;
  if (AFRICA_HINT(lon, lat) && !(lat > 35 && lon < 30)) return 'afr';
  if (lon > -32 && lon < 45 && lat > 34) return 'eur'; // the rest of Europe, Iceland and the Atlantic islands
  if (lon < -30) return lat > 20 ? 'nam' : 'lat';
  if (lon > 110 && lat < 0) return 'oce';
  return 'eas';
}

// even-odd scanline fill of each country's rings (unwrapped in x so rings crossing the map edge wrap cleanly)
const grid = new Uint8Array(W * H); // 0 sea, 1..9 region index + 1
const RUSSIA = 15;
function fillRings(rings, val) {
  const edges = [];
  for (const ring of rings) {
    let prevX = null;
    const pts = ring.map(([lon, lat]) => { let x = px(lon); if (prevX !== null) { while (x - prevX > W / 2) x -= W; while (prevX - x > W / 2) x += W; } prevX = x; return [x, py(lat)]; });
    for (let i = 0; i < pts.length - 1; i++) edges.push([pts[i], pts[i + 1]]);
  }
  for (let y = 0; y < H; y++) {
    const sy = y + 0.5, xs = [];
    for (const [[x0, y0], [x1, y1]] of edges) if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (const off of [-W, 0, W]) {
      const a = Math.max(0, Math.ceil(xs[k] + off - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] + off - 0.5));
      for (let x = a; x <= b; x++) grid[y * W + x] = val;
    }
  }
}
for (const f of countries) {
  const name = f.properties?.name ?? '';
  const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  for (const poly of polys) {
    const [lon, lat] = poly[0].reduce(([a, b], [x, y]) => [a + x / poly[0].length, b + y / poly[0].length], [0, 0]);
    const reg = regionOf(name, lon, lat);
    fillRings(poly, reg === 'russia' ? RUSSIA : REGIONS.indexOf(reg) + 1);
  }
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y * W + x] === RUSSIA) { const lon = LON0 + ((x + 0.5) / W) * 360; grid[y * W + x] = REGIONS.indexOf(lon > 0 && lon < 60 ? 'eur' : 'eas') + 1; }
for (let y = 0; y < H; y++) if (py(LAT_BOTTOM + 0) - y < 0) for (let x = 0; x < W; x++) grid[y * W + x] = REGIONS.indexOf('ice') + 1;

// run-length encode, row-major: varint run lengths with the value in the low 4 bits
const bytes = [];
let i = 0;
while (i < grid.length) {
  const v = grid[i]; let n = 1;
  while (i + n < grid.length && grid[i + n] === v) n++;
  let word = (n << 4) | v;
  while (word >= 0x80) { bytes.push((word & 0x7f) | 0x80); word = Math.floor(word / 128); }
  bytes.push(word);
  i += n;
}
const b64 = Buffer.from(bytes).toString('base64');
const out = `// Generated by tools/build-earth.mjs (#138) from Natural Earth 1:50m countries (public domain, via world-atlas).
// Do not edit by hand. The real Earth's land at ${W}x${H}, Miller projection ${LAT_TOP}N to ${-LAT_BOTTOM}S, cut at ${-LON0}W,
// each pixel one of the game's demand regions (or ice). Run-length encoded: varint (run << 4 | value), base64.
export const EARTH = Object.freeze({
  w: ${W}, h: ${H}, lon0: ${LON0}, latTop: ${LAT_TOP}, latBottom: ${LAT_BOTTOM},
  regions: Object.freeze(${JSON.stringify(REGIONS)}), // value 0 = sea, k = regions[k - 1]
  rle: '${b64}',
});
`;
writeFileSync(new URL('../src/art/earth-data.js', import.meta.url), out);
const counts = REGIONS.map((r, k) => `${r} ${grid.reduce((n, v) => n + (v === k + 1), 0)}`);
console.log(`earth-data.js ${W}x${H}, ${(b64.length / 1024).toFixed(0)} KB base64; ${counts.join(', ')}`);
