// Génère src/workerSource.ts à partir du worker autonome de maplibre-gl.
// Appelé automatiquement par les scripts npm "prepackage" et "prestart".
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const workerPath = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
if (!existsSync(workerPath)) {
    console.error(`Fichier introuvable : ${workerPath}. Lancez d'abord "npm install".`);
    process.exit(1);
}
const source = readFileSync(workerPath, "utf8");
writeFileSync(
    "src/workerSource.ts",
    "export const WORKER_SOURCE: string = " + JSON.stringify(source) + ";\n"
);
console.log(`workerSource.ts généré (${source.length} caractères).`);
