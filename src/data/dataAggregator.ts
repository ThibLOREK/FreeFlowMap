/**
 * Agrégation des flux identiques (même départ, même arrivée, même catégorie) :
 * les valeurs sont sommées. Limite le nombre de flux affichés en gardant les plus grandes valeurs.
 */
import { Flow, FlowRow } from "./types";

export interface AggregateResult {
    flows: Flow[];
    /** Nombre de flux non affichés à cause de la limite maximale. */
    truncated: number;
}

export function aggregateFlows(rows: FlowRow[], maxFlows: number, aggregate: boolean = true): AggregateResult {
    const map = new Map<string, Flow>();
    for (const r of rows) {
        const key = aggregate
            ? `${r.startLat}|${r.startLng}|${r.endLat}|${r.endLng}|${r.category ?? ""}`
            : `row${r.rowIndex}`;
        const existing = map.get(key);
        if (existing) {
            existing.value += r.value;
            existing.rowIndexes.push(r.rowIndex);
        } else {
            map.set(key, {
                key,
                startLat: r.startLat,
                startLng: r.startLng,
                endLat: r.endLat,
                endLng: r.endLng,
                value: r.value,
                flowId: r.flowId,
                category: r.category,
                rowIndexes: [r.rowIndex]
            });
        }
    }
    let flows = Array.from(map.values());
    let truncated = 0;
    if (flows.length > maxFlows) {
        flows.sort((a, b) => b.value - a.value);
        truncated = flows.length - maxFlows;
        flows = flows.slice(0, maxFlows);
    }
    return { flows, truncated };
}
