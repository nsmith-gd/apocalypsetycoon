// Dialogue tree engine (#54, director note D2): branching conversations with guests, run headlessly or by a UI.
//
// FORMAT (plain data; the authored archetype trees in ./trees are valid input)
//   TREE    { id, start, nodes: { [id]: NODE }, vars?: { name: number } (starting values) }
//   NODE    line:   { speaker: 'guest'|'you'|'narrator', text, alt?: [{ when, text }], onEnter?: EFFECTS, choices: [CHOICE] }
//           ending: { ending: <end state id>, text, onEnter?: EFFECTS }
//   CHOICE  { text, next, when?: CONDITION, effects?: EFFECTS, once?: true }
//
// CONDITIONS  every key in one object must hold; compose with { all: [..] }, { any: [..] }, { not: COND }
//   trait: 'vain'            the guest has the trait (visible, hidden or learned)
//   notTrait: 'vain'         ...does not
//   archetype / wealthClass  the guest is this archetype / wealth class (string or list)
//   reputation: CMP          the company's reputation (CMP = number for >=, or { gte, gt, lte, lt, eq })
//   heat: CMP                current heat
//   crisis: { track?, ...CMP }   tension of a track (default: the guest's dominant fear; '$fear' works too)
//   var: { name: CMP }       a conversation variable (trust, or any set by effects)
//   flag: 'name' / notFlag   a conversation or campaign flag
//   visited: 'nodeId'        the conversation has passed through that node
//   band, bandBelow, breach, anyBreach, headline, schemed, suspicious, track
//                            the crisis-aware vocabulary from world-state.js (#57), passed straight through
//
// EFFECTS  one object per choice (or node onEnter). The engine applies the conversation-local ones itself and
//   hands EVERY effect to one sink, onEffect(effect, runner), so the game applies heat, reputation, leads... in
//   one place:
//   set: { var: n }, add: { var: n }, flag: 'name' | ['a', 'b'], reveal: 'traitId'   (local: change runner state)
//   trust: n                 shorthand for add: { trust: n }
//   heat: n, reputation: n   world effects: only the sink applies them
//   fear, trait, aggressive, slip, promise, learn   the outcome vocabulary of outcomes.js (#55), collected
//
// END STATES  a node with `ending` ends the conversation; runner.result() gives { ending, path, effects, vars,
//   flags, revealed }. The ending ids the game knows are in outcomes.js ENDINGS; validateDialogue can check them.
//
//   const run = new DialogueRunner(tree, { guest, context: { reputation, heat, tension, world, flags }, onEffect });
//   run.choices -> [{ index, text, risky }];  run.choose(index);  run.done;  run.result()
//   runHeadless(tree, { guest, context, pick: [0, 2, 1] | (choices, runner) => index })

import { conditionHolds, CONDITION_KEYS as WORLD_KEYS, QUIET_WORLD } from './world-state.js';

export const ENGINE_LIMITS = Object.freeze({ maxSteps: 200 });
const LOCAL_EFFECTS = ['set', 'add', 'flag', 'reveal', 'trust'];
const WORLD_EFFECTS = ['heat', 'reputation'];
const OUTCOME_EFFECTS = ['fear', 'trait', 'aggressive', 'slip', 'promise', 'learn'];
export const EFFECT_KEYS = Object.freeze([...LOCAL_EFFECTS, ...WORLD_EFFECTS, ...OUTCOME_EFFECTS]);
const ENGINE_CONDITIONS = ['all', 'any', 'not', 'trait', 'notTrait', 'archetype', 'wealthClass', 'reputation', 'heat', 'crisis', 'var', 'flag', 'notFlag', 'visited'];
export const CONDITION_KEYS = Object.freeze([...ENGINE_CONDITIONS, ...WORLD_KEYS]);
const CMP_KEYS = ['gte', 'gt', 'lte', 'lt', 'eq'];

const list = (v) => (Array.isArray(v) ? v : [v]);

/** Compare a number against CMP: a number means >=, or { gte, gt, lte, lt, eq } (all given must hold). */
export function compare(value, cmp) {
  if (typeof cmp === 'number') return value >= cmp;
  const v = Number(value ?? 0);
  return (cmp.gte == null || v >= cmp.gte) && (cmp.gt == null || v > cmp.gt) && (cmp.lte == null || v <= cmp.lte)
    && (cmp.lt == null || v < cmp.lt) && (cmp.eq == null || v === cmp.eq);
}

export class DialogueRunner {
  /**
   * @param tree      a dialogue tree (format above)
   * @param guest     { name, archetype, wealthClass, traits[], hiddenTraits[], fears[], dominantFear? }
   * @param context   { reputation, heat, tension: { trackId: 0-100 }, world (worldState snapshot), flags: [] }
   *                  any value may also be a function, read each time a condition asks
   * @param onEffect  (effect, runner) => void   the single place effects reach the game
   * @param fill      (text, runner) => text     placeholder filler for the UI (default: {name})
   */
  constructor(tree, { guest = {}, context = {}, onEffect = null, fill = null } = {}) {
    if (!tree?.nodes?.[tree.start]) throw new Error(`dialogue "${tree?.id}": start node missing`);
    this.tree = tree;
    this.guest = guest;
    this.context = context;
    this.onEffect = onEffect;
    this.fillText = fill;
    this.vars = { trust: 0, ...(tree.vars ?? {}) };
    this.flags = new Set(this.read('flags') ?? []);
    this.revealed = new Set();
    this.effects = []; // every effect applied, in order (outcome vocabulary feeds resolveOutcome)
    this.taken = new Set(); // "node:index" of choices taken (for once: true)
    this.path = [];
    this.steps = 0;
    this.enter(tree.start);
  }

  read(key) { const v = this.context[key]; return typeof v === 'function' ? v() : v; }
  get nodeId() { return this.path[this.path.length - 1]; }
  get node() { return this.tree.nodes[this.nodeId]; }
  get done() { return this.node.ending != null; }
  get ending() { return this.done ? this.node.ending : null; }
  get fear() { return this.guest.dominantFear ?? this.guest.fears?.[0] ?? null; }
  traits() { return new Set([...(this.guest.traits ?? []), ...(this.guest.hiddenTraits ?? []), ...this.revealed]); }

  // ---------- conditions ----------
  holds(when) {
    if (!when) return true;
    for (const [k, v] of Object.entries(when)) if (!this.test(k, v)) return false;
    return true;
  }

  test(k, v) {
    switch (k) {
      case 'all': return list(v).every((c) => this.holds(c));
      case 'any': return list(v).some((c) => this.holds(c));
      case 'not': return !this.holds(v);
      case 'trait': return list(v).every((t) => this.traits().has(t));
      case 'notTrait': return list(v).every((t) => !this.traits().has(t));
      case 'archetype': return list(v).includes(this.guest.archetype);
      case 'wealthClass': return list(v).includes(this.guest.wealthClass);
      case 'reputation': return compare(this.read('reputation') ?? 0, v);
      case 'heat': return compare(this.read('heat') ?? 0, v);
      case 'crisis': {
        const { track = '$fear', ...cmp } = v;
        const id = track === '$fear' ? this.fear : track;
        return compare((this.read('tension') ?? {})[id] ?? 0, cmp);
      }
      case 'var': return Object.entries(v).every(([name, cmp]) => compare(this.vars[name] ?? 0, cmp));
      case 'flag': return list(v).every((f) => this.flags.has(f));
      case 'notFlag': return list(v).every((f) => !this.flags.has(f));
      case 'visited': return list(v).every((n) => this.path.includes(n));
      default:
        if (WORLD_KEYS.includes(k)) return conditionHolds({ [k]: v }, this.guest, this.read('world') ?? QUIET_WORLD);
        throw new Error(`unknown dialogue condition "${k}"`);
    }
  }

  // ---------- effects ----------
  apply(effects) {
    if (!effects) return;
    const e = { ...effects };
    if (e.fear === '$guest') e.fear = this.fear;
    else if (e.fear === '$other') e.fear = this.guest.otherFear ?? null;
    for (const [name, n] of Object.entries(e.set ?? {})) this.vars[name] = n;
    for (const [name, n] of Object.entries(e.add ?? {})) this.vars[name] = (this.vars[name] ?? 0) + n;
    if (e.trust) this.vars.trust += e.trust;
    for (const f of e.flag ? list(e.flag) : []) this.flags.add(f);
    if (e.reveal) this.revealed.add(e.reveal);
    if (e.learn) this.revealed.add(e.learn);
    this.effects.push(e);
    this.onEffect?.(e, this);
  }

  // ---------- flow ----------
  enter(id) {
    if (!this.tree.nodes[id]) throw new Error(`dialogue "${this.tree.id}": node "${id}" missing`);
    if (++this.steps > ENGINE_LIMITS.maxSteps) throw new Error(`dialogue "${this.tree.id}": too many steps (loop?)`);
    this.path.push(id);
    this.apply(this.tree.nodes[id].onEnter);
  }

  fill(text) { return this.fillText ? this.fillText(text, this) : String(text).replace(/\{name\}/g, this.guest.name ?? 'the guest'); }
  get rawText() { return (this.node.alt ?? []).find((a) => this.holds(a.when))?.text ?? this.node.text; }
  get text() { return this.fill(this.rawText); }
  get speaker() { return this.node.speaker ?? 'narrator'; }

  /** Choices on offer now: gated by `when`, and `once` choices already taken are gone. */
  get choices() {
    if (this.done) return [];
    return (this.node.choices ?? []).map((c, index) => ({ c, index }))
      .filter(({ c, index }) => this.holds(c.when) && !(c.once && this.taken.has(`${this.nodeId}:${index}`)))
      .map(({ c, index }) => ({ index, text: this.fill(c.text), risky: !!(c.effects?.aggressive || c.effects?.slip), gated: !!c.when }));
  }

  choose(index) {
    if (this.done) throw new Error('The conversation is over.');
    const c = this.node.choices?.[index];
    if (!c) throw new Error(`No choice ${index} at "${this.nodeId}"`);
    if (!this.choices.some((x) => x.index === index)) throw new Error(`Choice ${index} at "${this.nodeId}" is not on offer`);
    this.taken.add(`${this.nodeId}:${index}`);
    this.apply(c.effects);
    this.enter(c.next);
    return this;
  }

  result() {
    if (!this.done) throw new Error('The conversation has not ended.');
    return { tree: this.tree.id, ending: this.ending, path: [...this.path], effects: [...this.effects], vars: { ...this.vars }, flags: [...this.flags], revealed: [...this.revealed] };
  }
}

/**
 * Play a tree from start to an end node without a UI. pick: a list of choice indexes to take in order
 * (falls back to the first on-offer choice when the list runs out) or a function (choices, runner) => index.
 */
export function runHeadless(tree, { pick = [], ...opts } = {}) {
  const run = new DialogueRunner(tree, opts);
  let i = 0;
  while (!run.done) {
    const offered = run.choices;
    if (!offered.length) throw new Error(`dialogue "${tree.id}": stuck at "${run.nodeId}" with no choice on offer`);
    const want = typeof pick === 'function' ? pick(offered, run) : pick[i++];
    run.choose(want ?? offered[0].index);
  }
  return run.result();
}

// ---------- validator ----------
function checkCondition(when, at, bad) {
  if (!when || typeof when !== 'object' || Array.isArray(when)) { bad.push(`${at}: condition must be an object`); return; }
  if (!Object.keys(when).length) bad.push(`${at}: empty condition`);
  for (const [k, v] of Object.entries(when)) {
    if (!CONDITION_KEYS.includes(k)) { bad.push(`${at}: unknown condition "${k}"`); continue; }
    if (k === 'all' || k === 'any') { if (!Array.isArray(v) || !v.length) bad.push(`${at}: ${k} needs a list`); else v.forEach((c, i) => checkCondition(c, `${at}.${k}[${i}]`, bad)); }
    if (k === 'not') checkCondition(v, `${at}.not`, bad);
    if (['reputation', 'heat'].includes(k) && !(typeof v === 'number' || (v && Object.keys(v).length && Object.keys(v).every((x) => CMP_KEYS.includes(x))))) bad.push(`${at}: ${k} needs a number or { gte, gt, lte, lt, eq }`);
    if (k === 'crisis' && !(v && Object.keys(v).some((x) => CMP_KEYS.includes(x)) && Object.keys(v).every((x) => CMP_KEYS.includes(x) || x === 'track'))) bad.push(`${at}: crisis needs { track?, gte|gt|lte|lt|eq }`);
    if (k === 'var' && !(v && typeof v === 'object' && Object.keys(v).length)) bad.push(`${at}: var needs { name: comparison }`);
  }
}

/**
 * Problems with a tree (empty list = valid). Options: endings (known end-state ids), traits (known trait ids),
 * tracks (known track ids). Rules: start exists, every `next` exists, every node reachable, an ending reachable
 * from every node, every line node offers at least one unconditional choice, known condition and effect keys.
 */
export function validateDialogue(tree, { endings = null, traits = null, tracks = null } = {}) {
  const bad = [];
  const at0 = tree?.id ?? '(no id)';
  if (!tree?.id) bad.push('missing id');
  const nodes = tree?.nodes ?? {};
  if (!nodes[tree?.start]) bad.push(`start "${tree?.start}" missing`);
  for (const [id, n] of Object.entries(nodes)) {
    if (typeof n.text !== 'string' || !n.text.trim()) bad.push(`${id}: missing text`);
    (n.alt ?? []).forEach((a, i) => checkCondition(a.when, `${id}.alt[${i}]`, bad));
    if (n.onEnter) checkEffects(n.onEnter, `${id}.onEnter`, bad, { traits, tracks });
    if (n.ending != null) {
      if (endings && !endings.includes(n.ending)) bad.push(`${id}: unknown ending "${n.ending}"`);
      if (n.choices?.length) bad.push(`${id}: an ending can't have choices`);
      continue;
    }
    if (!Array.isArray(n.choices) || !n.choices.length) { bad.push(`${id}: a line needs choices (or make it an ending)`); continue; }
    if (n.choices.every((c) => c.when)) bad.push(`${id}: every choice is gated, the player could get stuck`);
    n.choices.forEach((c, i) => {
      const at = `${id}.choices[${i}]`;
      if (typeof c.text !== 'string' || !c.text.trim()) bad.push(`${at}: missing text`);
      if (!nodes[c.next]) bad.push(`${at}: next "${c.next}" missing`);
      if (c.when !== undefined) checkCondition(c.when, at, bad);
      if (c.effects) checkEffects(c.effects, at, bad, { traits, tracks });
    });
  }
  if (nodes[tree?.start]) {
    const seen = new Set();
    const stack = [tree.start];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || !nodes[id]) continue;
      seen.add(id);
      for (const c of nodes[id].choices ?? []) stack.push(c.next);
    }
    for (const id of Object.keys(nodes)) if (!seen.has(id)) bad.push(`${id}: unreachable`);
    // an ending must be reachable from every node (no dead loops)
    const canEnd = new Set(Object.keys(nodes).filter((id) => nodes[id].ending != null));
    let grew = true;
    while (grew) {
      grew = false;
      for (const [id, n] of Object.entries(nodes)) if (!canEnd.has(id) && (n.choices ?? []).some((c) => canEnd.has(c.next))) { canEnd.add(id); grew = true; }
    }
    for (const id of seen) if (!canEnd.has(id)) bad.push(`${id}: no ending can be reached from here`);
  }
  return bad.map((b) => `${at0}: ${b}`);
}

function checkEffects(e, at, bad, { traits, tracks }) {
  for (const [k, v] of Object.entries(e)) {
    if (!EFFECT_KEYS.includes(k)) { bad.push(`${at}: unknown effect "${k}"`); continue; }
    if (['trust', 'heat', 'reputation'].includes(k) && !Number.isFinite(v)) bad.push(`${at}: ${k} must be a number`);
    if ((k === 'set' || k === 'add') && !(v && Object.values(v).every(Number.isFinite))) bad.push(`${at}: ${k} needs { name: number }`);
    if (traits && ['trait', 'learn', 'reveal'].includes(k) && !traits.includes(v)) bad.push(`${at}: unknown trait "${v}"`);
    if (tracks && k === 'fear' && !['$guest', '$other'].includes(v) && !tracks.includes(v)) bad.push(`${at}: unknown track "${v}"`);
  }
}
