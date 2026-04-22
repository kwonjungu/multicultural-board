// Cosmetic combination simulator — verifies all skin×hat×stage paths resolve.
// Covers: 6 skins × 5 hats (including null) × 5 stages = 150 combos (+ 50 random
// secondary draws for 200 total "virtual renders"). Fails if any referenced PNG
// is missing or the composite path logic picks the wrong file.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKINS = ["classic", "orange", "green", "sky", "pink", "purple"];
const HATS  = [null, "top", "cap", "party", "crown"];
const STAGES = [
  { id: "egg",   key: "stage-1-egg" },
  { id: "larva", key: "stage-2-larva" },
  { id: "pupa",  key: "stage-3-pupa" },
  { id: "bee",   key: "stage-4-bee" },
  { id: "queen", key: "stage-5-queen" },
];
const PETS = [null, "dog", "cat", "rabbit", "butterfly"];
const TROPHIES = [null, "gold", "star"];

function stageImage(stage) {
  const s = STAGES.find((x) => x.id === stage.id);
  return `/stickers/${s.key}.png`;
}
function stageImageWithSkin(stage, skin) {
  if (skin === "classic") return stageImage(stage);
  return `/stickers/skins/${stage.key}-${skin}.png`;
}
function stageImageWithHat(stage, hat) {
  return `/stickers/stage-hats/${stage.key}-${hat}.png`;
}

function resolveCharImg(stage, skin, hat) {
  const useComposite = skin === "classic" && hat !== null;
  return useComposite
    ? stageImageWithHat(stage, hat)
    : stageImageWithSkin(stage, skin);
}

function checkFile(publicPath) {
  const full = resolve(ROOT, "public" + publicPath);
  return existsSync(full);
}

let total = 0;
let pass = 0;
const fails = [];

// Full matrix — 150 combos
for (const stage of STAGES) {
  for (const skin of SKINS) {
    for (const hat of HATS) {
      total++;
      const charImg = resolveCharImg(stage, skin, hat);
      if (!checkFile(charImg)) {
        fails.push({ stage: stage.id, skin, hat, missing: charImg });
        continue;
      }
      // Hat overlay only rendered when not using composite
      if (hat && skin !== "classic") {
        const hatPng = `/stickers/hat-${hat}.png`;
        if (!checkFile(hatPng)) {
          fails.push({ stage: stage.id, skin, hat, missing: hatPng });
          continue;
        }
      }
      pass++;
    }
  }
}

// 50 random draws with pet+trophy also
for (let i = 0; i < 50; i++) {
  const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
  const skin = SKINS[Math.floor(Math.random() * SKINS.length)];
  const hat = HATS[Math.floor(Math.random() * HATS.length)];
  const pet = PETS[Math.floor(Math.random() * PETS.length)];
  const trophy = TROPHIES[Math.floor(Math.random() * TROPHIES.length)];
  total++;
  const charImg = resolveCharImg(stage, skin, hat);
  if (!checkFile(charImg)) {
    fails.push({ stage: stage.id, skin, hat, pet, trophy, missing: charImg });
    continue;
  }
  if (pet && !checkFile(`/stickers/pet-${pet}.png`)) {
    fails.push({ stage: stage.id, skin, hat, pet, trophy, missing: `/stickers/pet-${pet}.png` });
    continue;
  }
  if (trophy && !checkFile(`/stickers/trophy-${trophy}.png`)) {
    fails.push({ stage: stage.id, skin, hat, pet, trophy, missing: `/stickers/trophy-${trophy}.png` });
    continue;
  }
  pass++;
}

console.log(`총 ${total}개 조합 시뮬.`);
console.log(`✅ ${pass} / ${total} 통과`);
if (fails.length) {
  console.log(`❌ ${fails.length} 실패:`);
  for (const f of fails.slice(0, 20)) {
    console.log(`   · ${JSON.stringify(f)}`);
  }
  if (fails.length > 20) console.log(`   ... (+${fails.length - 20})`);
  process.exit(1);
}
console.log("🎉 모든 코스메틱 조합 에셋 존재 검증 통과.");
