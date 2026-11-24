// Starter dialogue trees for guest archetypes (#56, director note D2), their validator, and a minimal
// runner so a conversation can be played from the event flow (src/events/attend.js -> talk -> lead).
//
// The full dialogue engine is #54. Until it lands, `Conversation` below walks a tree; it is deliberately
// small so #54 can replace it. The tree format is plain data, so the engine can read the same trees.
//
// TREE   { id, archetype, title, start, nodes: { [nodeId]: NODE } }   6-10 nodes, no cycles
// NODE   line:   { speaker: 'guest' | 'you' | 'narrator', text, choices: [CHOICE x1-4] }
//        ending: { ending: <ENDINGS id from outcomes.js>, text }
// CHOICE { text, next: nodeId, effects?: { trust, fear, trait, aggressive, slip, promise, learn } }
//        fear: a threat track id, or '$guest' (the guest's own fear) / '$other' (a fear they don't have).
// TEXT   may use {name} (the guest), {fear} (their fear's name) and {otherFear} (a fear they don't have),
//        and, reading the live world (#57), {level} ("boiling over") and {headline} (latest about their fear).
// CRISIS-AWARE (#57, src/dialogue/world-state.js for the condition vocabulary)
//        NODE.alt:    [{ when: CONDITION, text }]  the first alt whose condition holds replaces the text
//        CHOICE.when: CONDITION                    the choice is only offered when it holds
//        Every line node keeps at least one choice without `when`, so a calm world can always answer.
// RULES  every node reachable; at least two different winning endings and at least one rebuffed/backfire.

import { ENDINGS, resolveOutcome } from './outcomes.js';
import { TRACKS, TRACK_BY_ID } from '../world/tracks.js';
import { TREES } from './trees/index.js';
import { conditionHolds, worldWords, CONDITION_KEYS, BANDS_FOR_CONDITIONS, QUIET_WORLD } from './world-state.js';

export const TRAITS = Object.freeze(['vain', 'paranoid', 'family', 'skeptic', 'gambler', 'discreet', 'practical', 'ruthless', 'traditional', 'futurist']);

// Twelve guest archetypes, the wealth classes they turn up in and their usual traits. #53 owns the full
// guest roster; a guest that carries `archetype` uses it, otherwise `archetypeFor` picks one by class.
export const ARCHETYPES = Object.freeze({
  prepper: { label: 'Billionaire prepper', classes: ['C1', 'C2'], traits: ['paranoid', 'practical'] },
  tech_founder: { label: 'Tech founder', classes: ['C2', 'C3'], traits: ['vain', 'futurist'] },
  crypto_whale: { label: 'Crypto whale', classes: ['C1', 'C2'], traits: ['gambler', 'paranoid'] },
  celebrity: { label: 'Celebrity', classes: ['C1', 'C2'], traits: ['vain', 'family'] },
  hedge_fund: { label: 'Hedge-fund manager', classes: ['C2', 'C3'], traits: ['skeptic', 'gambler'] },
  oil_heir: { label: 'Oil heir', classes: ['C3', 'C4'], traits: ['vain', 'family'] },
  dowager: { label: 'Old-money dowager', classes: ['C3', 'C4'], traits: ['traditional', 'family'] },
  pharma: { label: 'Pharma executive', classes: ['C2', 'C3'], traits: ['skeptic', 'discreet'] },
  politician: { label: 'Politician', classes: ['C3', 'C4'], traits: ['discreet', 'ruthless'] },
  general: { label: 'Retired general', classes: ['C3', 'C4'], traits: ['paranoid', 'practical'] },
  royal: { label: 'Exiled royal', classes: ['C4', 'C5'], traits: ['vain', 'traditional'] },
  oligarch: { label: 'Oligarch', classes: ['C4', 'C5'], traits: ['ruthless', 'paranoid'] },
});

export const DIALOGUE_LIMITS = Object.freeze({ minNodes: 6, maxNodes: 10, maxChoices: 4 });
const EFFECT_KEYS = new Set(['trust', 'fear', 'trait', 'aggressive', 'slip', 'promise', 'learn']);
const PLACEHOLDERS = new Set(['name', 'fear', 'otherFear', 'level', 'headline']);
function checkCondition(when, at, bad) {
  if (!when || typeof when !== 'object' || !Object.keys(when).length) { bad.push(`${at}: empty condition`); return; }
  for (const [k, v] of Object.entries(when)) {
    if (!CONDITION_KEYS.includes(k)) bad.push(`${at}: unknown condition "${k}"`);
    if ((k === 'band' || k === 'bandBelow') && !BANDS_FOR_CONDITIONS.includes(v)) bad.push(`${at}: band "${v}"`);
    if (k === 'track' && !TRACK_BY_ID[v]) bad.push(`${at}: track "${v}"`);
    if (['breach', 'anyBreach', 'headline', 'schemed'].includes(k) && v !== true) bad.push(`${at}: ${k} must be true`);
    if (k === 'suspicious' && typeof v !== 'boolean') bad.push(`${at}: suspicious must be true or false`);
  }
}
const WIN = (e) => ENDINGS[e]?.win;
const FAIL_ENDINGS = new Set(['rebuffed', 'backfire']);

/** Problems with one tree (empty list when it passes). */
export function validateTree(tree) {
  const bad = [];
  const where = tree?.id ?? '(no id)';
  if (!tree?.id) bad.push('missing id');
  if (!ARCHETYPES[tree?.archetype]) bad.push(`unknown archetype "${tree?.archetype}"`);
  const nodes = tree?.nodes ?? {};
  const ids = Object.keys(nodes);
  if (ids.length < DIALOGUE_LIMITS.minNodes || ids.length > DIALOGUE_LIMITS.maxNodes) bad.push(`${ids.length} nodes (needs ${DIALOGUE_LIMITS.minNodes}-${DIALOGUE_LIMITS.maxNodes})`);
  if (!nodes[tree?.start]) bad.push(`start node "${tree?.start}" missing`);
  const checkText = (t, at) => {
    if (typeof t !== 'string' || !t.trim()) { bad.push(`${at}: empty text`); return; }
    for (const m of t.matchAll(/\{(\w+)\}/g)) if (!PLACEHOLDERS.has(m[1])) bad.push(`${at}: unknown placeholder {${m[1]}}`);
  };
  for (const [id, n] of Object.entries(nodes)) {
    checkText(n.text, id);
    if (n.ending != null) {
      if (!ENDINGS[n.ending]) bad.push(`${id}: unknown ending "${n.ending}"`);
      if (n.choices?.length) bad.push(`${id}: an ending can't have choices`);
      continue;
    }
    if (!['guest', 'you', 'narrator'].includes(n.speaker)) bad.push(`${id}: speaker "${n.speaker}"`);
    (n.alt ?? []).forEach((a, i) => { checkText(a.text, `${id}.alt[${i}]`); checkCondition(a.when, `${id}.alt[${i}]`, bad); });
    if (Array.isArray(n.choices) && n.choices.length && n.choices.every((c) => c.when)) bad.push(`${id}: every choice is conditional (a calm world could not answer)`);
    if (!Array.isArray(n.choices) || n.choices.length < 1 || n.choices.length > DIALOGUE_LIMITS.maxChoices) { bad.push(`${id}: needs 1-${DIALOGUE_LIMITS.maxChoices} choices`); continue; }
    n.choices.forEach((c, i) => {
      const at = `${id}.choices[${i}]`;
      checkText(c.text, at);
      if (c.when !== undefined) checkCondition(c.when, at, bad);
      if (!nodes[c.next]) bad.push(`${at}: next "${c.next}" missing`);
      for (const [k, v] of Object.entries(c.effects ?? {})) {
        if (!EFFECT_KEYS.has(k)) bad.push(`${at}: unknown effect "${k}"`);
        if (k === 'trust' && !(Number.isFinite(v) && Math.abs(v) <= 30)) bad.push(`${at}: trust ${v}`);
        if (k === 'fear' && !['$guest', '$other'].includes(v) && !TRACK_BY_ID[v]) bad.push(`${at}: fear "${v}"`);
        if ((k === 'trait' || k === 'learn') && !TRAITS.includes(v)) bad.push(`${at}: trait "${v}"`);
        if ((k === 'aggressive' || k === 'slip') && v !== true) bad.push(`${at}: ${k} must be true`);
        if (k === 'promise' && (typeof v !== 'string' || !v)) bad.push(`${at}: promise`);
      }
    });
  }
  if (nodes[tree?.start]) {
    // reachability + no cycles (depth-first with a path stack)
    const seen = new Set();
    const endings = new Set();
    const visit = (id, path) => {
      if (path.includes(id)) { bad.push(`cycle through ${id}`); return; }
      const n = nodes[id];
      if (!n) return;
      seen.add(id);
      if (n.ending) { endings.add(n.ending); return; }
      for (const c of n.choices ?? []) visit(c.next, [...path, id]);
    };
    visit(tree.start, []);
    for (const id of ids) if (!seen.has(id)) bad.push(`${id}: unreachable`);
    const wins = [...endings].filter(WIN);
    if (wins.length < 2) bad.push(`needs 2 different winning endings, has ${wins.length}`);
    if (![...endings].some((e) => FAIL_ENDINGS.has(e))) bad.push('needs a way to fail or backfire');
  }
  return bad.map((b) => `${where}: ${b}`);
}

/** Validate every tree and the archetype coverage. Throws listing every problem. */
export function validateTrees(trees = TREES) {
  const bad = trees.flatMap(validateTree);
  const ids = trees.map((t) => t.id);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) bad.push(`duplicate tree id ${id}`);
  for (const a of Object.keys(ARCHETYPES)) if (!trees.some((t) => t.archetype === a)) bad.push(`no tree for archetype ${a}`);
  if (bad.length) throw new Error(`Dialogue trees invalid:\n${[...new Set(bad)].join('\n')}`);
  return true;
}

const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** Which archetype a guest from the event list is. Uses guest.archetype when the roster (#53) provides it. */
export function archetypeFor(guest) {
  if (guest?.archetype && ARCHETYPES[guest.archetype]) return guest.archetype;
  const fits = Object.keys(ARCHETYPES).filter((a) => ARCHETYPES[a].classes.includes(guest?.wealthClass));
  const pool = fits.length ? fits : Object.keys(ARCHETYPES);
  return pool[hash(guest?.id ?? guest?.name ?? '') % pool.length];
}

export function treeFor(guest, trees = TREES) {
  const a = archetypeFor(guest);
  const options = trees.filter((t) => t.archetype === a);
  return options[hash(`${guest?.id}:tree`) % options.length] ?? null;
}

const trackName = (id) => TRACK_BY_ID[id]?.name ?? 'the end of the world';

/** Minimal runner: walk a tree for one guest, collect choice effects, finish into an outcome (#55). */
export class Conversation {
  constructor({ guest, tree = treeFor(guest), rng = Math.random, world = null } = {}) {
    if (!tree) throw new Error('No dialogue tree for this guest.');
    this.tree = tree;
    this.archetype = tree.archetype;
    this.guest = { ...guest, traits: guest.traits?.length ? guest.traits : [...ARCHETYPES[tree.archetype].traits] };
    this.rng = rng;
    this.world = world ?? QUIET_WORLD; // live crisis snapshot (#57): worldState({ crisis, schemes })
    this.fear = this.guest.fears?.[0] ?? 'atomic';
    const others = TRACKS.filter((t) => t.classic && !(this.guest.fears ?? []).includes(t.id));
    this.otherFear = others[hash(guest?.id) % others.length].id;
    this.nodeId = tree.start;
    this.effects = [];
    this.path = [tree.start];
  }

  fill(text) {
    const w = worldWords({ ...this.guest, fears: [this.fear] }, this.world);
    return text.replace(/\{name\}/g, this.guest.name ?? 'the guest').replace(/\{fear\}/g, trackName(this.fear)).replace(/\{otherFear\}/g, trackName(this.otherFear))
      .replace(/\{level\}/g, w.level).replace(/\{headline\}/g, w.headline);
  }

  /** Does a tree condition hold for this guest right now? */
  holds(when) { return conditionHolds(when, this.guest, this.world); }

  get node() { return this.tree.nodes[this.nodeId]; }
  get done() { return !!this.node.ending; }
  /** The node's line, using the first alternative whose condition holds in the live world. */
  get rawText() { return (this.node.alt ?? []).find((a) => this.holds(a.when))?.text ?? this.node.text; }
  get text() { return this.fill(this.rawText); }
  get speaker() { return this.node.speaker ?? 'narrator'; }
  /** Choices offered now (conditional ones only when their condition holds). `index` is the tree index. */
  get choices() {
    if (this.done) return [];
    return this.node.choices.map((c, i) => ({ c, i })).filter(({ c }) => this.holds(c.when))
      .map(({ c, i }) => ({ index: i, text: this.fill(c.text), risky: !!(c.effects?.aggressive || c.effects?.slip), live: !!c.when }));
  }

  choose(i) {
    if (this.done) throw new Error('The conversation is over.');
    const c = this.node.choices[i];
    if (!c) throw new Error(`No choice ${i}`);
    if (!this.holds(c.when)) throw new Error(`Choice ${i} isn't on offer right now.`);
    const e = { ...(c.effects ?? {}) };
    if (e.fear === '$guest') e.fear = this.fear;
    else if (e.fear === '$other') e.fear = this.otherFear;
    this.effects.push(e);
    this.nodeId = c.next;
    this.path.push(c.next);
    return this.node;
  }

  /** The #55 outcome for the ending reached. */
  finish({ context = {} } = {}) {
    if (!this.done) throw new Error('The conversation has not ended.');
    return resolveOutcome({ ending: this.node.ending, guest: this.guest, effects: this.effects, context: { world: this.world, ...context }, rng: this.rng });
  }
}
