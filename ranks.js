const fs = require("fs");
const path = require("path");

const RANKS = [
  ["Bronze I", "Bronze_1-removebg-preview.png"],
  ["Bronze II", "Bronze_2-removebg-preview.png"],
  ["Bronze III", "Bronze_3-removebg-preview.png"],
  ["Silver I", "134-1340121_rocket-league-silver-1-hd-png-download-removebg-preview.png"],
  ["Silver II", "Plata_2.png"],
  ["Silver III", "548-5489393_ranked-doubles-2v2-division-iiisilver-iii-rocket-league-removebg-preview.png"],
  ["Gold I", "Oro_1.webp"],
  ["Gold II", "Oro_2.png"],
  ["Gold III", "34-344152_ranked-duel-1v1-division-iiigold-iii-gold-4.png"],
  ["Platinum I", "Platino_1.png"],
  ["Platinum II", "Platino_2.png"],
  ["Platinum III", "Platino_3.png"],
  ["Diamond I", "Diamante_1.webp"],
  ["Diamond II", "Diamante_2.png"],
  ["Diamond III", "Diamante_3.webp"],
  ["Champion I", "Champion_1.webp"],
  ["Champion II", "Champion_2.webp"],
  ["Champion III", "Champion_3.webp"],
  ["Grand Champion I", "GC_2.png"],
  ["Grand Champion II", "GC_3.webp"],
  ["Grand Champion III", "GC_3.webp"],
  ["SSL", "SSL.png"]
];

const ranksDir = path.resolve(__dirname, "../assets/ranks");

function rankFromMMR(mmr) {
  const value = Math.max(0, Math.min(2200, Number(mmr) || 0));
  if (value >= 2100) return { index: 21, name: "SSL", progress: Math.min(100, Math.max(1, value - 2100 + 1)), file: "SSL.png" };
  const index = Math.min(20, Math.floor(value / 100));
  const progress = Math.max(1, (value % 100) || (value === 0 ? 1 : 100));
  const [name, file] = RANKS[index];
  return { index, name, progress, file };
}

function mmrForRank(name, points = 1) {
  const index = RANKS.findIndex(r => r[0].toLowerCase() === String(name).toLowerCase());
  if (index < 0) throw new Error("Rango no encontrado.");
  const p = Math.max(1, Math.min(100, Number(points) || 1));
  if (index === 21) return 2100 + p - 1;
  return index * 100 + p;
}

function rankImagePath(rank) {
  const p = path.join(ranksDir, rank.file);
  return fs.existsSync(p) ? p : path.join(ranksDir, "unranked.png");
}

module.exports = { RANKS, rankFromMMR, mmrForRank, rankImagePath };
