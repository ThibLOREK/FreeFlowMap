/**
 * Rendu SVG (D3) des flux : un tracé et une pointe par flux, puis les étiquettes de valeur, dans un calque
 * au-dessus de la carte. La géométrie est recalculée en pixels à chaque rendu à partir du cache de projection.
 * L'épaisseur de chaque flèche est calculée relativement aux autres flux affichés (voir thicknessScale.ts).
 */
import * as d3 from "d3";
import { Flow } from "../data/types";
import { ProjectionCache } from "../map/projection";
import { computeCurve, endTangentAngle, quadraticPath, quadraticPointAt, splitQuadratic } from "./curveCalculator";
import { arrowHeadPoints, arrowSize } from "./arrowRenderer";
import { computeThicknesses, ScaleMode } from "./thicknessScale";

export interface RenderOptions {
    color: string;
    /** Opacité de 0 à 1. */
    opacity: number;
    /** Courbure en fraction de la corde. */
    curvature: number;
    minThickness: number;
    maxThickness: number;
    scaleMode: ScaleMode;
    showLabels: boolean;
    labelFontSize: number;
    /** Longueur minimale (px) du flux pour afficher son étiquette. */
    labelMinLength: number;
    formatValue: (value: number) => string;
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

export class FlowRenderer {
    private readonly arrowLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    private readonly labelLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
    private flows: Flow[] = [];

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

    /** Dessine les flux et retourne le nombre de tracés effectivement produits. */
    public render(options: RenderOptions): number {
        const thicknesses = computeThicknesses(
            this.flows.map((f) => f.value),
            { min: options.minThickness, max: options.maxThickness, mode: options.scaleMode }
        );
        const items: RenderedFlow[] = [];

        this.flows.forEach((flow, i) => {
            const thickness = thicknesses[i];
            const size = arrowSize(thickness);
            const start = this.projection.project(flow.startLng, flow.startLat);
            const end = this.projection.project(flow.endLng, flow.endLat);
            const curve = computeCurve(start, end, options.curvature);
            if (curve.chord < 1) {
                return;
            }
            // La pointe ne dépasse jamais 60 % de la longueur du trajet.
            const length = Math.min(size.length, curve.chord * 0.6);
            const halfWidth = size.halfWidth * (length / size.length);
            const angle = endTangentAngle(curve);
            const shaft = splitQuadratic(curve, 1 - length / curve.chord);

            let label: string | null = null;
            let labelX = 0;
            let labelY = 0;
            if (options.showLabels && curve.chord >= options.labelMinLength) {
                // Milieu de la courbe, décalé du côté du bombement : les flux inverses ont leurs étiquettes de côtés opposés.
                const mid = quadraticPointAt(curve, 0.5);
                const nx = -(end.y - start.y) / curve.chord;
                const ny = (end.x - start.x) / curve.chord;
                const offset = thickness / 2 + options.labelFontSize * 0.8;
                label = options.formatValue(flow.value);
                labelX = mid.x + nx * offset;
                labelY = mid.y + ny * offset;
            }

            items.push({
                key: flow.key,
                shaft: quadraticPath(shaft),
                head: arrowHeadPoints(curve.end, angle, length, halfWidth),
                thickness,
                label,
                labelX,
                labelY
            });
        });

        const groups = this.arrowLayer.selectAll<SVGGElement, RenderedFlow>("g.flow").data(items, (d) => d.key);
        groups.exit().remove();
        const entered = groups.enter().append("g").attr("class", "flow");
        entered.append("path").attr("class", "shaft").attr("fill", "none");
        entered.append("polygon").attr("class", "head");

        const all = entered.merge(groups);
        all.order();
        // L'opacité est appliquée au groupe pour que tracé et pointe ne se cumulent pas.
        all.attr("opacity", options.opacity);
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
            .text((d) => d.label ?? "");

        return items.length;
    }
}
