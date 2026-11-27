/**
 * Détection de la flèche sous le pointeur : distance en pixels entre un point et une courbe quadratique,
 * calculée sur une approximation par segments. Permet de garder la carte entièrement déplaçable et zoomable
 * (le calque SVG ne capture aucun événement de souris).
 */
import { QuadraticCurve, quadraticPointAt } from "../flows/curveCalculator";

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(px - ax, py - ay);
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToQuadratic(curve: QuadraticCurve, x: number, y: number, steps: number = 24): number {
    let previous = curve.start;
    let best = Infinity;
    for (let i = 1; i <= steps; i++) {
        const current = quadraticPointAt(curve, i / steps);
        const d = distanceToSegment(x, y, previous.x, previous.y, current.x, current.y);
        if (d < best) {
            best = d;
        }
        previous = current;
    }
    return best;
}
