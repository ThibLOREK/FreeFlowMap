/**
 * Rendu SVG (D3) des flux : un tracé et une pointe par flux, dans un calque au-dessus de la carte.
 * La géométrie est recalculée en pixels à chaque rendu à partir du cache de projection.
 */
import * as d3 from "d3";
import { Flow } from "../data/types";
import { ProjectionCache } from "../map/projection";
import { computeCurve, endTangentAngle, quadraticPath, splitQuadratic } from "./curveCalculator";
import { arrowHeadPoints, arrowSize } from "./arrowRenderer";

export interface RenderOptions {
    color: string;
    /** Opacité de 0 à 1. */
    opacity: number;
    /** Courbure en fraction de la corde. */
    curvature: number;
    /** Épaisseur du trait en pixels (valeur fixe provisoire jusqu'à l'étape 5). */
    thickness: number;
}

interface RenderedFlow {
    key: string;
    shaft: string;
    head: string;
}

export class FlowRenderer {
    private readonly layer: d3.Selection<SVGGElement, unknown, null, undefined>;
    private flows: Flow[] = [];

    constructor(
        svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        private readonly projection: ProjectionCache
    ) {
        this.layer = svg.append("g").attr("class", "flows");
    }

    public setFlows(flows: Flow[]): void {
        this.flows = flows;
    }

    /** Dessine les flux et retourne le nombre de tracés effectivement produits. */
    public render(options: RenderOptions): number {
        const items: RenderedFlow[] = [];
        const size = arrowSize(options.thickness);

        for (const flow of this.flows) {
            const start = this.projection.project(flow.startLng, flow.startLat);
            const end = this.projection.project(flow.endLng, flow.endLat);
            const curve = computeCurve(start, end, options.curvature);
            if (curve.chord < 1) {
                continue;
            }
            // La pointe ne dépasse jamais 60 % de la longueur du trajet.
            const length = Math.min(size.length, curve.chord * 0.6);
            const halfWidth = size.halfWidth * (length / size.length);
            const angle = endTangentAngle(curve);
            const shaft = splitQuadratic(curve, 1 - length / curve.chord);
            items.push({
                key: flow.key,
                shaft: quadraticPath(shaft),
                head: arrowHeadPoints(curve.end, angle, length, halfWidth)
            });
        }

        const groups = this.layer.selectAll<SVGGElement, RenderedFlow>("g.flow").data(items, (d) => d.key);
        groups.exit().remove();
        const entered = groups.enter().append("g").attr("class", "flow");
        entered.append("path").attr("class", "shaft").attr("fill", "none");
        entered.append("polygon").attr("class", "head");

        const all = entered.merge(groups);
        // L'opacité est appliquée au groupe pour que tracé et pointe ne se cumulent pas.
        all.attr("opacity", options.opacity);
        all.select<SVGPathElement>("path.shaft")
            .attr("d", (d) => d.shaft)
            .attr("stroke", options.color)
            .attr("stroke-width", options.thickness);
        all.select<SVGPolygonElement>("polygon.head")
            .attr("points", (d) => d.head)
            .attr("fill", options.color);
        return items.length;
    }
}
