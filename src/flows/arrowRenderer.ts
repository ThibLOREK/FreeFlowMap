/**
 * Pointes de flèche (triangle plein), orientées selon la tangente de la courbe à l'arrivée.
 */
import { Point } from "./curveCalculator";

export interface ArrowSize {
    length: number;
    halfWidth: number;
}

/** Taille proportionnelle à l'épaisseur, avec un minimum pour rester visible sur les flux fins. */
export function arrowSize(thickness: number): ArrowSize {
    return {
        length: Math.max(10, thickness * 3.5),
        halfWidth: Math.max(5, thickness * 1.75)
    };
}

function f(n: number): string {
    return n.toFixed(2);
}

/**
 * Points d'un triangle dont la pointe est à `tip`, orienté selon `angle` (radians),
 * au format de l'attribut SVG `points`.
 */
export function arrowHeadPoints(tip: Point, angle: number, length: number, halfWidth: number): string {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const bx = tip.x - ux * length;
    const by = tip.y - uy * length;
    const px = -uy;
    const py = ux;
    return (
        `${f(tip.x)},${f(tip.y)} ` +
        `${f(bx + px * halfWidth)},${f(by + py * halfWidth)} ` +
        `${f(bx - px * halfWidth)},${f(by - py * halfWidth)}`
    );
}
