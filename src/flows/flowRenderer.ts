/**
 * Rendu SVG (D3) des flux : un tracé et une pointe par flux, puis les étiquettes de valeur, dans un calque
 * au-dessus de la carte. La géométrie est recalculée en pixels à chaque rendu à partir du cache de projection.
 * L'épaisseur de chaque flèche est calculée relativement aux autres flux affichés (voir thicknessScale.ts).
 * La pointe s'arrête avant la coordonnée d'arrivée, avec un écart dynamique (voir endpointSpacing.ts).
 * Les flux dont départ et arrivée sont identiques sont dessinés en boucle (voir loopCalculator.ts).
 * Le calque ne capture aucun événement de souris : la détection d'une flèche passe par hitTest().
 */
import * as d3 from "d3";
import { Flow } from "../data/types";
import { ProjectionCache } from "../map/projection";
import { distanceToPolyline, distanceToQuadratic } from "../interactions/hitTest";
import {
    Curve,
    Point,
    QuadraticCurve,
    arrivalDirection,
    computeCurve,
    endTangentAngle,
    parameterAtDistanceFromEnd,
    quadraticPath,
    quadraticPointAt,
    splitQuadratic
} from "./curveCalculator";
import { arrowHeadPoints, arrowSize, ArrowSize } from "./arrowRenderer";
import { computeEndGaps } from "./endpointSpacing";
import {
    LOOP_NEIGHBOUR_RADIUS_PX,
    PortIndex,
    chooseLoopDirection,
    computeLoop,
    isLoopFlow,
    loopSize
} from "./loopCalculator";
import { computeThicknesses, ScaleMode } from "./thicknessScale";

/** Écart maximal (px) entre la pointe et la coordonnée, quelle que soit la densité d'arrivées. */
const MAX_END_GAP_PX = 48;
/** Rayon (px) dans lequel des arrivées sont considérées comme « au même endroit ». */
const CLUSTER_RADIUS_PX = 14;
/** Écart minimal (px) entre la pointe d'une boucle et son point GPS. */
const MIN_LOOP_GAP_PX = 4;

export interface RenderOptions {
    color: string;
    /** Opacité de 0 à 1. */
    opacity: number;
    /** Courbure en fraction de la corde. */
    curvature: number;
    /** Écart de base (px) entre la pointe et la coordonnée d'arrivée. */
    endGap: number;
    /** Adapte l'écart à la densité d'arrivées (et donc au zoom). */
    dynamicGap: boolean;
    minThickness: number;
    maxThickness: number;
    scaleMode: ScaleMode;
    showLabels: boolean;
    labelFontSize: number;
    /** Longueur minimale (px) du flux pour afficher son étiquette. */
    labelMinLength: number;
    formatValue: (value: number) => string;
    /** Clés des flux sélectionnés ; les autres sont atténués s'il y a une sélection. */
    selectedKeys: Set<string>;
    /** Facteur d'opacité (0 à 1) des flux non sélectionnés. */
    dimFactor: number;
}

interface RenderedFlow {
    key: string;
    shaft: string;
    head: string;
    thickness: number;
    label: string | null;
    labelX: number;
    labelY: number;
}

interface HitItem {
    key: string;
    tolerance: number;
    /** Courbe quadratique (flèches normales). */
    curve?: QuadraticCurve;
    /** Ligne brisée (boucles). */
    polyline?: Point[];
}

interface PreparedFlow {
    flow: Flow;
    thickness: number;
    size: ArrowSize;
    curve: Curve;
}

interface PreparedLoop {
    flow: Flow;
    thickness: number;
    size: ArrowSize;
    origin: Point;
}

/** Direction (radians) dans laquelle la courbe quitte son point de départ. */
function departureDirection(curve: Curve): number {
    let dx = curve.control.x - curve.start.x;
    let dy = curve.control.y - curve.start.y;
    if (Math.hypot(dx, dy) < 1e-6) {
        dx = curve.end.x - curve.start.x;
        dy = curve.end.y - curve.start.y;
    }
    return Math.atan2(dy, dx);
}

export class FlowRenderer {
    private readonly arrowLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    private readonly labelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    private flows: Flow[] = [];
    private hitItems: HitItem[] = [];

    constructor(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        private readonly projection: ProjectionCache
    ) {
        this.arrowLayer = svg.append("g").attr("class", "flows");
        this.labelLayer = svg.append("g").attr("class", "labels");
    }

    /** Les plus grands flux sont dessinés en premier : les petits restent visibles par-dessus. */
    public setFlows(flows: Flow[]): void {
        this.flows = [...flows].sort((a, b) => b.value - a.value);
    }

    /** Retourne la clé du flux sous le point (x, y) en pixels, ou null. Le flux dessiné au-dessus l'emporte. */
    public hitTest(x: number, y: number): string | null {
        let best: string | null = null;
        let bestDistance = Infinity;
        for (const item of this.hitItems) {
            let d = Infinity;
            if (item.curve) {
                d = distanceToQuadratic(item.curve, x, y);
            } else if (item.polyline) {
                d = distanceToPolyline(item.polyline, x, y);
            }
            if (d <= item.tolerance && d <= bestDistance) {
                best = item.key;
                bestDistance = d;
            }
        }
        return best;
    }

    /** Dessine les flux et retourne le nombre de tracés effectivement produits. */
    public render(options: RenderOptions): number {
        const thicknesses = computeThicknesses(
            this.flows.map((f) => f.value),
            { min: options.minThickness, max: options.maxThickness, mode: options.scaleMode }
        );

        // Passe 1 : projection ; séparation des flèches normales et des boucles.
        const prepared: PreparedFlow[] = [];
        const loops: PreparedLoop[] = [];
        this.flows.forEach((flow, i) => {
            const thickness = thicknesses[i];
            const start = this.projection.project(flow.startLng, flow.startLat);
            if (isLoopFlow(flow.startLat, flow.startLng, flow.endLat, flow.endLng)) {
                loops.push({ flow, thickness, size: arrowSize(thickness), origin: start });
                return;
            }
            const end = this.projection.project(flow.endLng, flow.endLat);
            const curve = computeCurve(start, end, options.curvature);
            if (curve.chord < 1) {
                return;
            }
            prepared.push({ flow, thickness, size: arrowSize(thickness), curve });
        });

        // Écart entre pointe et coordonnée, selon la densité d'arrivées au zoom courant.
        const gaps = computeEndGaps(
            prepared.map((p) => ({
                end: p.curve.end,
                approachAngle: arrivalDirection(p.curve),
                headWidth: p.size.halfWidth * 2,
                chord: p.curve.chord
            })),
            {
                baseGap: options.endGap,
                dynamic: options.dynamicGap,
                maxGap: MAX_END_GAP_PX,
                clusterRadius: CLUSTER_RADIUS_PX
            }
        );

        // Passe 2 : courbe raccourcie, pointe et étiquette des flèches normales.
        const items: RenderedFlow[] = [];
        const hits: HitItem[] = [];
        prepared.forEach((p, i) => {
            const gap = gaps[i];
            const tip = gap > 0.5 ? splitQuadratic(p.curve, parameterAtDistanceFromEnd(p.curve, gap)) : p.curve;
            const tipChord = Math.hypot(tip.end.x - tip.start.x, tip.end.y - tip.start.y);
            if (tipChord < 2) {
                return;
            }
            const tipCurve: Curve = { start: tip.start, control: tip.control, end: tip.end, chord: tipChord };
            // La pointe ne dépasse jamais 60 % de la longueur visible du trajet.
            const length = Math.min(p.size.length, tipChord * 0.6);
            const halfWidth = p.size.halfWidth * (length / p.size.length);
            const angle = endTangentAngle(tipCurve);
            const shaft = splitQuadratic(tipCurve, 1 - length / tipChord);

            let label: string | null = null;
            let labelX = 0;
            let labelY = 0;
            if (options.showLabels && tipChord >= options.labelMinLength) {
                // Milieu de la courbe, décalé du côté du bombement : les flux inverses ont leurs étiquettes de côtés opposés.
                const mid = quadraticPointAt(tipCurve, 0.5);
                const nx = -(tipCurve.end.y - tipCurve.start.y) / tipChord;
                const ny = (tipCurve.end.x - tipCurve.start.x) / tipChord;
                const offset = p.thickness / 2 + options.labelFontSize * 0.8;
                label = options.formatValue(p.flow.value);
                labelX = mid.x + nx * offset;
                labelY = mid.y + ny * offset;
            }

            items.push({
                key: p.flow.key,
                shaft: quadraticPath(shaft),
                head: arrowHeadPoints(tipCurve.end, angle, length, halfWidth),
                thickness: p.thickness,
                label,
                labelX,
                labelY
            });
            hits.push({ key: p.flow.key, curve: tipCurve, tolerance: Math.max(p.thickness / 2, 4) + 4 });
        });

        // Boucles : orientées vers le plus grand secteur libre autour de leur point.
        if (loops.length > 0) {
            const ports = new PortIndex();
            for (const p of prepared) {
                ports.add({ x: p.curve.start.x, y: p.curve.start.y, angle: departureDirection(p.curve) });
                ports.add({ x: p.curve.end.x, y: p.curve.end.y, angle: arrivalDirection(p.curve) });
            }
            for (const loop of loops) {
                const neighbours = ports.anglesNear(loop.origin.x, loop.origin.y, LOOP_NEIGHBOUR_RADIUS_PX);
                const direction = chooseLoopDirection(neighbours);
                // Les boucles suivantes au même endroit éviteront celle-ci.
                ports.add({ x: loop.origin.x, y: loop.origin.y, angle: direction });

                const size = loopSize(loop.thickness);
                const headLength = Math.min(loop.size.length, size * 0.45);
                const halfWidth = loop.size.halfWidth * (headLength / loop.size.length);
                const gap = Math.max(options.endGap, MIN_LOOP_GAP_PX);
                const geometry = computeLoop(loop.origin, direction, size, gap, headLength);

                let label: string | null = null;
                let labelX = 0;
                let labelY = 0;
                if (options.showLabels) {
                    const offset = loop.thickness / 2 + options.labelFontSize * 0.8;
                    label = options.formatValue(loop.flow.value);
                    labelX = geometry.apex.x + Math.cos(direction) * offset;
                    labelY = geometry.apex.y + Math.sin(direction) * offset;
                }

                items.push({
                    key: loop.flow.key,
                    shaft: geometry.shaft,
                    head: arrowHeadPoints(geometry.tip, geometry.angle, headLength, halfWidth),
                    thickness: loop.thickness,
                    label,
                    labelX,
                    labelY
                });
                hits.push({
                    key: loop.flow.key,
                    polyline: geometry.polyline,
                    tolerance: Math.max(loop.thickness / 2, 4) + 4
                });
            }
        }
        this.hitItems = hits;

        const hasSelection = options.selectedKeys.size > 0;
        const groupOpacity = (d: RenderedFlow): number =>
            hasSelection && !options.selectedKeys.has(d.key) ? options.opacity * options.dimFactor : options.opacity;

        const groups = this.arrowLayer.selectAll<SVGGElement, RenderedFlow>("g.flow").data(items, (d) => d.key);
        groups.exit().remove();
        const entered = groups.enter().append("g").attr("class", "flow");
        entered.append("path").attr("class", "shaft").attr("fill", "none");
        entered.append("polygon").attr("class", "head");

        const all = entered.merge(groups);
        all.order();
        // L'opacité est appliquée au groupe pour que tracé et pointe ne se cumulent pas.
        all.attr("opacity", groupOpacity);
        all.select<SVGPathElement>("path.shaft")
            .attr("d", (d) => d.shaft)
            .attr("stroke", options.color)
            .attr("stroke-width", (d) => d.thickness);
        all.select<SVGPolygonElement>("polygon.head")
            .attr("points", (d) => d.head)
            .attr("fill", options.color);

        const labelItems = items.filter((d) => d.label !== null);
        const labels = this.labelLayer.selectAll<SVGTextElement, RenderedFlow>("text.label").data(labelItems, (d) => d.key);
        labels.exit().remove();
        const labelsEntered = labels
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("paint-order", "stroke")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 3)
            .attr("stroke-linejoin", "round")
            .attr("fill", "#222222")
            .style("font-family", "sans-serif");
        labelsEntered
            .merge(labels)
            .attr("x", (d) => d.labelX)
            .attr("y", (d) => d.labelY)
            .attr("font-size", options.labelFontSize)
            .attr("opacity", (d) => (hasSelection && !options.selectedKeys.has(d.key) ? options.dimFactor : 1))
            .text((d) => d.label ?? "");

        return items.length;
    }
}
