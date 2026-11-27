/**
 * Géométrie des courbes, calculée en pixels après projection.
 * Les points de départ et d'arrivée sont ceux du GPS projetés : seul le point de contrôle est décalé.
 * Courbe de Bézier quadratique simple ; la séparation des flux inverses et proches vient à l'étape 4.
 */
export interface Point {
    x: number;
    y: number;
}

export interface QuadraticCurve {
    start: Point;
    control: Point;
    end: Point;
}

export interface Curve extends QuadraticCurve {
    /** Distance en pixels entre départ et arrivée. */
    chord: number;
}

const MAX_OFFSET_PX = 250;
/** En dessous de cette distance (px), la courbure est réduite progressivement (trajets très courts). */
const SHORT_CHORD_PX = 60;

/**
 * @param curvature décalage du point de contrôle en fraction de la corde (ex. 0.2).
 * Le décalage est à gauche du sens de déplacement : A→B et B→A se courbent donc de côtés opposés.
 */
export function computeCurve(start: Point, end: Point, curvature: number): Curve {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const chord = Math.hypot(dx, dy);
    if (chord < 1e-6) {
        return { start, control: { x: start.x, y: start.y }, end, chord: 0 };
    }
    const shortFactor = Math.min(1, chord / SHORT_CHORD_PX);
    const offset = Math.min(curvature * chord, MAX_OFFSET_PX) * shortFactor;
    const nx = -dy / chord;
    const ny = dx / chord;
    return {
        start,
        control: { x: (start.x + end.x) / 2 + nx * offset, y: (start.y + end.y) / 2 + ny * offset },
        end,
        chord
    };
}

/** Angle (radians) de la tangente à l'arrivée de la courbe, orientée dans le sens du déplacement. */
export function endTangentAngle(curve: Curve): number {
    let dx = curve.end.x - curve.control.x;
    let dy = curve.end.y - curve.control.y;
    if (Math.hypot(dx, dy) < 1e-6) {
        dx = curve.end.x - curve.start.x;
        dy = curve.end.y - curve.start.y;
    }
    return Math.atan2(dy, dx);
}

/** Direction (radians) du point d'arrivée vers l'endroit d'où vient la courbe. */
export function arrivalDirection(curve: QuadraticCurve): number {
    let dx = curve.control.x - curve.end.x;
    let dy = curve.control.y - curve.end.y;
    if (Math.hypot(dx, dy) < 1e-6) {
        dx = curve.start.x - curve.end.x;
        dy = curve.start.y - curve.end.y;
    }
    return Math.atan2(dy, dx);
}

function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Point de la courbe quadratique au paramètre t (0 = départ, 1 = arrivée). */
export function quadraticPointAt(curve: QuadraticCurve, t: number): Point {
    const u = 1 - t;
    return {
        x: u * u * curve.start.x + 2 * u * t * curve.control.x + t * t * curve.end.x,
        y: u * u * curve.start.y + 2 * u * t * curve.control.y + t * t * curve.end.y
    };
}

/**
 * Paramètre t où la courbe se trouve à `distance` pixels (en ligne droite) de son point d'arrivée.
 * Recherche par dichotomie : la distance à l'arrivée décroit de la corde à 0 le long de la courbe.
 */
export function parameterAtDistanceFromEnd(curve: QuadraticCurve, distance: number): number {
    if (distance <= 0) {
        return 1;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const p = quadraticPointAt(curve, mid);
        if (Math.hypot(p.x - curve.end.x, p.y - curve.end.y) > distance) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

/** Première partie [0, t] d'une courbe quadratique (algorithme de De Casteljau). */
export function splitQuadratic(curve: QuadraticCurve, t: number): QuadraticCurve {
    const q0 = lerp(curve.start, curve.control, t);
    const q1 = lerp(curve.control, curve.end, t);
    return { start: curve.start, control: q0, end: lerp(q0, q1, t) };
}

function f(n: number): string {
    return n.toFixed(2);
}

export function quadraticPath(c: QuadraticCurve): string {
    return `M${f(c.start.x)},${f(c.start.y)} Q${f(c.control.x)},${f(c.control.y)} ${f(c.end.x)},${f(c.end.y)}`;
}
