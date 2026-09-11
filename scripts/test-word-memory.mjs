import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'bee-memory-'));
try {
  const source = readFileSync(join(root, 'lib/wordMemoryState.ts'), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
  }});
  writeFileSync(join(dir, 'state.mjs'), result.outputText);
  const { memoryReducer: reduce, initialMemoryState: init } = await import(pathToFileURL(join(dir, 'state.mjs')));
  const cards = [{id:'a1',pairKey:'a'},{id:'a2',pairKey:'a'}, {id:'b1',pairKey:'b'},{id:'b2',pairKey:'b'}];
  const flip = (s,id) => reduce(s,{type:'flip',id,cards});
  let count = 0;
  const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
  check('same card cannot form a pair', () => {
    const s = flip(init(),'a1'); assert.deepEqual(flip(s,'a1'),s);
  });
  check('third rapid tap is ignored; one move per pair', () => {
    const s = flip(flip(init(),'a1'),'b1');
    assert.equal(s.moves,1); assert.deepEqual(flip(s,'a2'),s); assert.equal(s.matched.length,0);
  });
  check('match awarded once, matched cards cannot be reused', () => {
    const s = flip(flip(init(),'a1'),'a2');
    const settled = reduce(s,{type:'settle',ids:s.flipped});
    assert.deepEqual(settled.matched,['a']); assert.equal(settled.moves,1);
    assert.deepEqual(flip(settled,'a1'),settled);
  });
  check('stale timer cannot clear another pair', () => {
    const s = flip(flip(init(),'b1'),'b2');
    assert.deepEqual(reduce(s,{type:'settle',ids:['a1','a2']}),s);
  });
  check('effect replay is idempotent', () => {
    const s = flip(flip(init(),'a1'),'a2'); const action = {type:'settle',ids:s.flipped};
    const once = reduce(s,action); assert.deepEqual(reduce(once,action),once);
  });
  check('unknown or obsolete card ID is ignored', () => assert.deepEqual(flip(init(),'missing'),init()));
  check('independent language round starts empty', () => {
    const old = flip(flip(init(),'a1'),'a2'); const fresh = init();
    assert.equal(old.moves,1); assert.deepEqual(fresh,{flipped:[],matched:[],moves:0});
  });
  check('all pairs complete without duplicate award', () => {
    let s = flip(flip(init(),'a1'),'a2'); s=reduce(s,{type:'settle',ids:s.flipped});
    s=flip(flip(s,'b1'),'b2'); assert.equal(s.moves,2); assert.equal(s.matched.length,2);
  });
  check('10,000 deterministic actions preserve invariants', () => {
    let s=init(), seed=17;
    for(let i=0;i<10000;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const prev=s;
      s=seed%7<5 ? flip(s,['a1','a2','b1','b2','missing'][seed%5]) : reduce(s,{type:'settle',ids:s.flipped});
      assert.ok(s.flipped.length<=2); assert.equal(new Set(s.flipped).size,s.flipped.length);
      assert.equal(new Set(s.matched).size,s.matched.length);
      assert.ok(s.moves>=prev.moves && s.moves<=prev.moves+1);
      if(s.matched.length===2) s=init();
    }
  });
  console.log(`${count} checks passed. UI lifecycle tests are specified separately; this suite checks state transitions.`);
} finally {
  // Only the absolute directory created by mkdtemp above is removed.
  rmSync(dir,{recursive:true,force:true});
}
