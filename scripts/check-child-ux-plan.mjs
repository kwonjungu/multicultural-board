import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dir=resolve(root,'docs/child-ux-20260911');
const plan=JSON.parse(readFileSync(resolve(dir,'tasks.json'),'utf8'));
assert.match(plan.baseline,/^[a-f0-9]{40}$/);
assert.equal(plan.productionRoom,'1111');
const ids=new Set(plan.tasks.map(t=>t.id));
assert.equal(ids.size,plan.tasks.length,'Duplicate task IDs');
const owner=new Map();
for(const t of plan.tasks){
  assert.ok(t.owner && t.output && t.files.length && t.checks.length,`Incomplete contract: ${t.id}`);
  for(const dep of t.dependsOn) assert.ok(ids.has(dep),`Unknown dependency ${dep}`);
  for(const file of t.files){
    assert.ok(!owner.has(file),`Duplicate exact file ownership ${file}`); owner.set(file,t.id);
  }
}
const visited=new Set(), active=new Set();
function visit(id){
  assert.ok(!active.has(id),`Dependency cycle at ${id}`);
  if(visited.has(id))return;
  active.add(id); plan.tasks.find(t=>t.id===id).dependsOn.forEach(visit);
  active.delete(id);visited.add(id);
}
ids.forEach(visit);
for(const f of ['README.md','OPUS-RUNBOOK.md','HARNESS.md','VALIDATION.md']) assert.ok(existsSync(resolve(dir,f)),`Missing ${f}`);
console.log(`PASS ${plan.tasks.length} task contracts, dependencies and required documents.`);
console.log('This validates the plan structure, NOT implementation, wildcard ownership overlap, UI quality or release readiness.');
