// Validate dialogue trees. `node tools/validate-dialogue.mjs` checks every tree in the index;
// `node tools/validate-dialogue.mjs src/dialogue/trees/x.js ...` checks just those files.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const files = process.argv.slice(2);
if (files.length) {
  // Load the validator without the index (which imports every tree).
  const { validateTree } = await import('../src/dialogue/trees.js').catch(async (e) => { throw e; });
  let bad = 0;
  for (const f of files) {
    const tree = (await import(pathToFileURL(resolve(f)).href)).default;
    const problems = validateTree(tree);
    console.log(problems.length ? `FAIL ${f}\n  ${problems.join('\n  ')}` : `ok   ${f} (${Object.keys(tree.nodes).length} nodes)`);
    bad += problems.length;
  }
  process.exit(bad ? 1 : 0);
} else {
  const { validateTrees } = await import('../src/dialogue/trees.js');
  const { TREES } = await import('../src/dialogue/trees/index.js');
  validateTrees(TREES);
  console.log(`ok   ${TREES.length} trees`);
}
