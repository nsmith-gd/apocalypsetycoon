// Minimal authoring format for dialogue trees (#54): a short text script that compiles to the engine's data.
//
//   tree crypto_tokens start=hello
//   vars trust=0
//
//   = hello guest
//   {name} jingles a hardware wallet. "You take tokens?"
//   ? [band boil] "{name}, have you seen the news?" replaces the line when the condition holds
//   * Of course. Your keys, your bunker. -> keys {trait vain, trust +5}
//   * [rep>=40] Only from people I trust. And I trust you. -> keys {trust +10}
//   * [trait paranoid | heat<30] Cash. Untraceable. -> cash {flag cash_deal}
//   * Tokens are a fad. Concrete isn't. -> rebuffed {aggressive}
//
//   = keys guest
//   ...
//   = win !sold_dream
//   They send a deposit before the canapes arrive.
//
// Lines
//   tree <id> start=<node>        once, first
//   vars a=1 b=2                  optional starting variables
//   = <node> <speaker>            a line node (speaker: guest | you | narrator)
//   = <node> !<ending>            an ending node
//   (text lines)                  the node's text (several lines join with a space)
//   ? [cond] text                 an alternative text when cond holds
//   > {effects}                   effects applied when the node is entered
//   * [cond] text -> next {effects}   a choice; [cond] and {effects} optional; "once" after next: shown once
//   # comment
//
// Conditions in [ ]: terms joined by "," (all) or "|" (any); "!" in front negates a term.
//   trait vain | archetype crypto_founder | class C2 | flag name | visited node
//   rep>=40 | heat<30 | trust>=10 (any variable) | crisis>=70 (guest's fear) | crisis atomic>=45
//   band boil | bandBelow brink | breach | anyBreach | headline | schemed | suspicious
// Effects in { }: comma-separated.
//   trust +5 | heat +2 | reputation -1 | set x=1 | add x=2 | flag name | reveal trait | learn trait
//   trait vain | fear $guest|$other|<track> | promise gold_taps | aggressive | slip

const CMP_OPS = { '>=': 'gte', '>': 'gt', '<=': 'lte', '<': 'lt', '=': 'eq', '==': 'eq' };

function parseTerm(raw, at) {
  let t = raw.trim();
  let neg = false;
  if (t.startsWith('!')) { neg = true; t = t.slice(1).trim(); }
  const wrap = (c) => (neg ? { not: c } : c);
  let m = t.match(/^(rep|reputation|heat|crisis(?:\s+\w+)?|\w+)\s*(>=|<=|==|=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const [, lhs, op, num] = m;
    const cmp = { [CMP_OPS[op]]: Number(num) };
    if (lhs === 'rep' || lhs === 'reputation') return wrap({ reputation: cmp });
    if (lhs === 'heat') return wrap({ heat: cmp });
    if (lhs.startsWith('crisis')) { const track = lhs.split(/\s+/)[1]; return wrap({ crisis: { ...(track ? { track } : {}), ...cmp } }); }
    return wrap({ var: { [lhs]: cmp } });
  }
  m = t.match(/^(\w+)(?:\s+(\S+))?$/);
  if (!m) throw new Error(`${at}: can't read condition "${raw}"`);
  const [, key, arg] = m;
  const needs = (k) => { if (!arg) throw new Error(`${at}: "${k}" needs a value`); return arg; };
  switch (key) {
    case 'trait': return neg ? { notTrait: needs(key) } : { trait: needs(key) };
    case 'flag': return neg ? { notFlag: needs(key) } : { flag: needs(key) };
    case 'archetype': return wrap({ archetype: needs(key) });
    case 'class': return wrap({ wealthClass: needs(key) });
    case 'visited': return wrap({ visited: needs(key) });
    case 'band': case 'bandBelow': return wrap({ [key]: needs(key) });
    case 'breach': case 'anyBreach': case 'headline': case 'schemed': return wrap({ [key]: true });
    case 'suspicious': return { suspicious: !neg };
    default: throw new Error(`${at}: unknown condition "${key}"`);
  }
}

export function parseCondition(src, at = 'condition') {
  const s = src.trim();
  if (s.includes('|') && s.includes(',')) throw new Error(`${at}: mix of "," and "|" (use one per condition)`);
  if (s.includes('|')) return { any: s.split('|').map((t) => parseTerm(t, at)) };
  const terms = s.split(',').map((t) => parseTerm(t, at));
  return terms.length === 1 ? terms[0] : { all: terms };
}

export function parseEffects(src, at = 'effects') {
  const e = {};
  for (const raw of src.split(',').map((x) => x.trim()).filter(Boolean)) {
    let m = raw.match(/^(trust|heat|reputation)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (m) { e[m[1]] = (e[m[1]] ?? 0) + Number(m[2]); continue; }
    m = raw.match(/^(set|add)\s+(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/);
    if (m) { e[m[1]] = { ...(e[m[1]] ?? {}), [m[2]]: Number(m[3]) }; continue; }
    m = raw.match(/^(flag|reveal|learn|trait|fear|promise)\s+(\S+)$/);
    if (m) {
      if (m[1] === 'flag') e.flag = e.flag ? [...[].concat(e.flag), m[2]] : m[2];
      else e[m[1]] = m[2];
      continue;
    }
    if (raw === 'aggressive' || raw === 'slip') { e[raw] = true; continue; }
    throw new Error(`${at}: can't read effect "${raw}"`);
  }
  return e;
}

/** Compile a script into a dialogue tree. Throws with the line number of the first problem. */
export function parseScript(text) {
  const tree = { id: null, start: null, nodes: {} };
  let node = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const at = `line ${i + 1}`;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    let m;
    if ((m = line.match(/^tree\s+(\S+)(?:\s+start=(\S+))?$/))) { tree.id = m[1]; tree.start = m[2] ?? null; return; }
    if ((m = line.match(/^vars\s+(.+)$/))) {
      tree.vars = {};
      for (const kv of m[1].split(/\s+/)) { const [k, v] = kv.split('='); if (!k || !Number.isFinite(Number(v))) throw new Error(`${at}: vars need name=number`); tree.vars[k] = Number(v); }
      return;
    }
    if ((m = line.match(/^=\s*(\w+)\s+(!?\w+)$/))) {
      const [, id, who] = m;
      if (tree.nodes[id]) throw new Error(`${at}: node "${id}" defined twice`);
      node = who.startsWith('!') ? { ending: who.slice(1), text: '' } : { speaker: who, text: '', choices: [] };
      if (!who.startsWith('!') && !['guest', 'you', 'narrator'].includes(who)) throw new Error(`${at}: speaker must be guest, you or narrator`);
      tree.nodes[id] = node;
      tree.start ??= id;
      return;
    }
    if (!node) throw new Error(`${at}: text before the first "= node" line`);
    if ((m = line.match(/^\?\s*\[([^\]]+)\]\s*(.+)$/))) { (node.alt ??= []).push({ when: parseCondition(m[1], at), text: m[2].trim() }); return; }
    if ((m = line.match(/^>\s*\{([^}]*)\}$/))) { node.onEnter = parseEffects(m[1], at); return; }
    if (line.startsWith('*')) {
      if (node.ending != null) throw new Error(`${at}: an ending can't have choices`);
      m = line.match(/^\*\s*(?:\[([^\]]+)\])?\s*(.+?)\s*->\s*(\w+)(\s+once)?\s*(?:\{([^}]*)\})?$/);
      if (!m) throw new Error(`${at}: a choice reads "* [cond] text -> next {effects}"`);
      const [, cond, txt, next, once, eff] = m;
      const choice = { text: txt, next };
      if (cond) choice.when = parseCondition(cond, at);
      if (eff) choice.effects = parseEffects(eff, at);
      if (once) choice.once = true;
      node.choices.push(choice);
      return;
    }
    node.text = node.text ? `${node.text} ${line}` : line;
  });
  if (!tree.id) throw new Error('script needs a "tree <id>" line');
  return tree;
}
