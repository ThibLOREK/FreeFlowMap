/**
 * Écart entre la pointe d'une flèche et la coordonnée GPS d'arrivée, calculé en pixels.
 * Les coordonnées GPS ne sont jamais modifiées : seul le tracé visible s'arrête avant le point.
 *
 * Les arrivées proches (dans un rayon en pixels) sont regroupées. Comme le calcul se fait en pixels à chaque rendu,
 * le zoom agit directement : quand on dézoome, davantage d'arrivées se regroupent et l'écart augmente ;
 * quand on zoome, les groupes se défont et l'écart revient à la valeur de base.
 * Dans un groupe, les pointes sont réparties en anneau autour du point selon leur direction d'arrivée ; deux pointes
 * trop proches en angle sont décalées radialement (niveaux successifs) pour ne pas se chevaucher.
 */
import { Point } from "./curveCalculator";

export interface EndpointInput {
    end: Point;
    /** Direction (radians) du point d'arrivée vers l'endroit d'où vient la flèche. */
    approachAngle: number;
    /** Largeur de la pointe de flèche en pixels. */
    headWidth: number;
    /** Distance départ-arrivée en pixels. */
    chord: number;
}

export interface SpacingOptions {
    /** Écart de base, en pixels. */
    baseGap: number;
    /** Si faux, l'écart de base est appliqué à toutes les flèches. */
    dynamic: boolean;
    maxGap: number;
    /** Rayon (px) de regroupement des arrivées voisines. */
    clusterRadius: number;
}

const MAX_LEVELS = 4;
/** L'écart ne dépasse jamais cette fraction de la longueur du flux. */
const MAX_CHORD_RATIO = 0.4;

function angularDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % (2 * Math.PI);
    return d > Math.PI ? 2 * Math.PI - d : d;
}

function findCluster(
    grid: Map<string, number[]>,
    clusters: Array<{ x: number; y: number }>,
    point: Point,
    cell: number,
    radius: number
): number {
    const cx = Math.floor(point.x / cell);
    const cy = Math.floor(point.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const ids = grid.get(`${cx + dx},${cy + dy}`);
            if (!ids) {
                continue;
            }
            for (const id of ids) {
                if (Math.hypot(clusters[id].x - point.x, clusters[id].y - point.y) <= radius) {
                    return id;
                }
            }
        }
    }
    return -1;
}

function clusterEnds(inputs: EndpointInput[], radius: number): number[][] {
    const cell = Math.max(1, radius);
    const grid = new Map<string, number[]>();
    const clusters: Array<{ x: number; y: number; members: number[] }> = [];
    inputs.forEach((input, i) => {
        let id = findCluster(grid, clusters, input.end, cell, radius);
        if (id < 0) {
            id = clusters.length;
            clusters.push({ x: input.end.x, y: input.end.y, members: [] });
            const key = `${Math.floor(input.end.x / cell)},${Math.floor(input.end.y / cell)}`;
            const list = grid.get(key);
            if (list) {
                list.push(id);
            } else {
                grid.set(key, [id]);
            }
        }
        clusters[id].members.push(i);
    });
    return clusters.map((c) => c.members);
}

/** Retourne l'écart (px) à appliquer à chaque arrivée, dans le même ordre que `inputs`. */
export function computeEndGaps(inputs: EndpointInput[], options: SpacingOptions): number[] {
    const gaps: number[] = inputs.map(() => options.baseGap);

    if (options.dynamic && inputs.length > 1) {
        for (const members of clusterEnds(inputs, options.clusterRadius)) {
            if (members.length < 2) {
                continue;
            }
            members.sort((a, b) => inputs[a].approachAngle - inputs[b].approachAngle);
            let maxHead = 0;
            for (const i of members) {
                maxHead = Math.max(maxHead, inputs[i].headWidth);
            }
            const levelStep = maxHead * 1.1;
            const radiusFor = (level: number): number => options.baseGap + maxHead * 0.5 + level * levelStep;
            // Pour chaque niveau : premier et dernier angles placés (les membres sont triés par angle).
            const firstAngle: number[] = [];
            const lastAngle: number[] = [];

            for (const i of members) {
                const angle = inputs[i].approachAngle;
                let chosen = MAX_LEVELS - 1;
                for (let level = 0; level < MAX_LEVELS; level++) {
                    const needed = Math.min(Math.PI, (inputs[i].headWidth * 1.2) / radiusFor(level));
                    const free =
                        lastAngle[level] === undefined ||
                        (angularDistance(angle, lastAngle[level]) >= needed &&
                            angularDistance(angle, firstAngle[level]) >= needed);
                    if (free) {
                        chosen = level;
                        break;
                    }
                }
                if (firstAngle[chosen] === undefined) {
                    firstAngle[chosen] = angle;
                }
                lastAngle[chosen] = angle;
                gaps[i] = radiusFor(chosen);
            }
        }
    }

    return gaps.map((gap, i) => Math.max(0, Math.min(gap, options.maxGap, inputs[i].chord * MAX_CHORD_RATIO)));
}
