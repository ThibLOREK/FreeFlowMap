/**
 * Flèches en boucle : flux dont les coordonnées GPS de départ et d'arrivée sont identiques.
 *
 * La boucle est une goutte (courbe de Bézier cubique) qui part du point GPS, fait un tour et revient s'arrêter
 * juste avant lui, avec une pointe orientée selon la tangente. Sa taille est calculée en pixels : elle reste lisible
 * quel que soit le zoom. Pour ne pas se superposer aux autres flèches, elle s'oriente vers le plus grand secteur
 * angulaire libre autour du point (autres départs et arrivées voisins, et boucles déjà placées au même endroit).
 */
import { Point } from "./curveCalculator";

interface CubicCurve {
    p0: Point;
    c1: Point;
    c2: Point;
    p3: Point;
}

export interface LoopGeometry {
    /** Tracé SVG du corps de la boucle, raccourci pour laisser la place à la pointe. */
    shaft: string;
    /** Point où se place la pointe de flèche. */
    tip: Point;
    /** Angle (radians) de la pointe, orienté dans le sens du déplacement. */
    angle: number;
    /** Points échantillonnés de la boucle complète, pour la détection du clic. */
    polyline: Point[];
    /** Sommet de la boucle (point le plus éloigné du point GPS). */
    apex: Point;
}

export interface Port {
    x: number;
    y: number;
    angle: number;
}

/** Hauteur de base d'une boucle (px) ; elle grandit avec l'épaisseur de la flèche. */
const LOOP_BASE_PX = 24;
const LOOP_THICKNESS_FACTOR = 2;
const LOOP_MAX_PX = 80;
/** Demi-ouverture (radians) des deux tangentes de la goutte autour de sa direction. */
const SPREAD = 0.9;
/** Décalage angulaire (radians) du point d'arrivée par rapport à la direction de la boucle. */
const TIP_ANGLE_OFFSET = 0.35;
/** Rayon (px) dans lequel les départs et arrivées voisins comptent pour l'orientation de la boucle. */
export const LOOP_NEIGHBOUR_RADIUS_PX = 12;
const DEFAULT_DIRECTION = -Math.PI / 2;
const TWO_PI = 2 * Math.PI;

/** Deux jeux de coordonnées GPS sont identiques à 0,1 mm près environ. */
export function isLoopFlow(startLat: number, startLng: number, endLat: number, endLng: number): boolean {
    return Math.abs(startLat - endLat) < 1e-9 && Math.abs(startLng - endLng) < 1e-9;
}

export function loopSize(thickness: number): number {
    return Math.min(LOOP_MAX_PX, LOOP_BASE_PX + thickness * LOOP_THICKNESS_FACTOR);
}

function unit(angle: number): Point {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

function cubicPointAt(c: CubicCurve, t: number): Point {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const d = 3 * u * t * t;
    const e = t * t * t;
    return {
        x: a * c.p0.x + b * c.c1.x + d * c.c2.x + e * c.p3.x,
        y: a * c.p0.y + b * c.c1.y + d * c.c2.y + e * c.p3.y
    };
}

function lerp(a: Point, b: Point, t: number): Point {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Première partie [0, t] d'une courbe cubique (algorithme de De Casteljau). */
function splitCubic(c: CubicCurve, t: number): CubicCurve {
    const p01 = lerp(c.p0, c.c1, t);
    const p12 = lerp(c.c1, c.c2, t);
    const p23 = lerp(c.c2, c.p3, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    return { p0: c.p0, c1: p01, c2: p012, p3: lerp(p012, p123, t) };
}

function f(n: number): string {
    return n.toFixed(2);
}

function cubicPath(c: CubicCurve): string {
    return `M${f(c.p0.x)},${f(c.p0.y)} C${f(c.c1.x)},${f(c.c1.y)} ${f(c.c2.x)},${f(c.c2.y)} ${f(c.p3.x)},${f(c.p3.y)}`;
}

/**
 * Paramètre t (dans la seconde moitié de la boucle) où la courbe est à `distance` pixels de son point d'arrivée.
 * La recherche démarre à t = 0,5 car le départ et l'arrivée sont proches l'un de l'autre.
 */
function parameterAtDistanceFromEnd(c: CubicCurve, distance: number): number {
    let lo = 0.5;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const p = cubicPointAt(c, mid);
        if (Math.hypot(p.x - c.p3.x, p.y - c.p3.y) > distance) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}

/**
 * @param origin point GPS projeté (pixels)
 * @param direction direction (radians) dans laquelle la boucle s'éloigne du point
 * @param size hauteur de la boucle (px)
 * @param gap distance (px) entre la pointe et le point GPS
 * @param headLength longueur (px) de la pointe de flèche
 */
export function computeLoop(origin: Point, direction: number, size: number, gap: number, headLength: number): LoopGeometry {
    const reach = size / (0.75 * Math.cos(SPREAD));
    const out1 = unit(direction - SPREAD);
    const out2 = unit(direction + SPREAD);
    const tipDirection = unit(direction + TIP_ANGLE_OFFSET);
    const tip: Point = { x: origin.x + tipDirection.x * gap, y: origin.y + tipDirection.y * gap };
    const cubic: CubicCurve = {
        p0: origin,
        c1: { x: origin.x + out1.x * reach, y: origin.y + out1.y * reach },
        c2: { x: origin.x + out2.x * reach, y: origin.y + out2.y * reach },
        p3: tip
    };

    const angle = Math.atan2(tip.y - cubic.c2.y, tip.x - cubic.c2.x);
    const shaft = splitCubic(cubic, parameterAtDistanceFromEnd(cubic, Math.min(headLength, size * 0.45)));

    const polyline: Point[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        polyline.push(cubicPointAt(cubic, i / steps));
    }

    return { shaft: cubicPath(shaft), tip, angle, polyline, apex: cubicPointAt(cubic, 0.5) };
}

function normalizeAngle(a: number): number {
    return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Direction du plus grand secteur angulaire libre entre les angles donnés (vers le haut s'il n'y en a aucun). */
export function chooseLoopDirection(angles: number[]): number {
    if (angles.length === 0) {
        return DEFAULT_DIRECTION;
    }
    const sorted = angles.map(normalizeAngle).sort((a, b) => a - b);
    let bestGap = -1;
    let bestMiddle = DEFAULT_DIRECTION;
    for (let i = 0; i < sorted.length; i++) {
        const from = sorted[i];
        const to = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TWO_PI;
        const gap = to - from;
        if (gap > bestGap) {
            bestGap = gap;
            bestMiddle = from + gap / 2;
        }
    }
    return bestMiddle;
}

/** Index spatial des départs et arrivées de flèches (position et direction), pour retrouver les voisins d'un point. */
export class PortIndex {
    private readonly cells = new Map<string, Port[]>();

    constructor(private readonly cellSize: number = 16) {}

    private key(cx: number, cy: number): string {
        return `${cx},${cy}`;
    }

    public add(port: Port): void {
        const k = this.key(Math.floor(port.x / this.cellSize), Math.floor(port.y / this.cellSize));
        const list = this.cells.get(k);
        if (list) {
            list.push(port);
        } else {
            this.cells.set(k, [port]);
        }
    }

    /** Angles des ports situés à moins de `radius` pixels de (x, y). */
    public anglesNear(x: number, y: number, radius: number): number[] {
        const result: number[] = [];
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        const reach = Math.max(1, Math.ceil(radius / this.cellSize));
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dy = -reach; dy <= reach; dy++) {
                const list = this.cells.get(this.key(cx + dx, cy + dy));
                if (!list) {
                    continue;
                }
                for (const p of list) {
                    if (Math.hypot(p.x - x, p.y - y) <= radius) {
                        result.push(p.angle);
                    }
                }
            }
        }
        return result;
    }
}
