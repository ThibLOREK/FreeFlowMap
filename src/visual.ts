import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import * as maplibregl from "maplibre-gl";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { WORKER_SOURCE } from "./workerSource";
import { VisualFormattingSettingsModel } from "./settings";
import { MapManager } from "./map/mapManager";
import { ProjectionCache } from "./map/projection";
import { parseFlows } from "./data/dataParser";
import { aggregateFlows } from "./data/dataAggregator";
import { Flow } from "./data/types";
import { FlowRenderer, RenderOptions } from "./flows/flowRenderer";
import "../style/visual.less";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

let workerConfigured = false;

/** Épaisseur provisoire des traits (px), remplacée par l'échelle normalisée à l'étape 5. */
const PROVISIONAL_THICKNESS = 3;
const MAX_ROWS = 30000;

/** Le worker MapLibre est embarqué dans le bundle et servi via une URL blob: (un visuel = un seul fichier). */
function configureWorker(): void {
    if (workerConfigured) {
        return;
    }
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    maplibregl.setWorkerUrl(url);
    workerConfigured = true;
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, value));
}

/** Signature numérique des flux affichés : sert à ne recadrer la carte que si les données changent. */
function computeSignature(flows: Flow[]): string {
    let h = flows.length;
    for (const f of flows) {
        h = (h * 31 + Math.round((f.startLat + f.startLng + f.endLat + f.endLng) * 1e4)) | 0;
    }
    return `${flows.length}:${h}`;
}

function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export class Visual implements IVisual {
    private readonly formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;
    private readonly mapContainer: HTMLDivElement;
    private readonly statusBox: HTMLDivElement;
    private readonly infoBox: HTMLDivElement;
    private readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private readonly mapManager: MapManager;
    private readonly projection: ProjectionCache;
    private readonly flowRenderer: FlowRenderer;
    private renderOptions: RenderOptions;
    private lastSignature: string = "";
    private rafPending: boolean = false;

    private readonly scheduleRender = (): void => {
        if (this.rafPending) {
            return;
        }
        this.rafPending = true;
        requestAnimationFrame(() => {
            this.rafPending = false;
            try {
                this.flowRenderer.render(this.renderOptions);
            } catch (e) {
                this.showStatus(`Rendu des flux : ${errorMessage(e)}`);
            }
        });
    };

    constructor(options: VisualConstructorOptions) {
        configureWorker();
        this.formattingSettingsService = new FormattingSettingsService();
        this.formattingSettings = new VisualFormattingSettingsModel();

        const root = document.createElement("div");
        root.style.position = "relative";
        root.style.width = "100%";
        root.style.height = "100%";
        options.element.appendChild(root);

        this.mapContainer = document.createElement("div");
        this.mapContainer.style.position = "absolute";
        this.mapContainer.style.inset = "0";
        this.mapContainer.style.zIndex = "0";
        root.appendChild(this.mapContainer);

        this.svg = d3.select(root).append("svg");
        this.svg
            .style("position", "absolute")
            .style("left", "0")
            .style("top", "0")
            .style("z-index", "1")
            .style("overflow", "visible")
            .style("pointer-events", "none");

        this.statusBox = document.createElement("div");
        this.statusBox.style.position = "absolute";
        this.statusBox.style.left = "8px";
        this.statusBox.style.top = "8px";
        this.statusBox.style.zIndex = "3";
        this.statusBox.style.padding = "4px 8px";
        this.statusBox.style.background = "rgba(255,255,255,0.9)";
        this.statusBox.style.font = "12px sans-serif";
        this.statusBox.style.display = "none";
        root.appendChild(this.statusBox);

        this.infoBox = document.createElement("div");
        this.infoBox.style.position = "absolute";
        this.infoBox.style.left = "8px";
        this.infoBox.style.bottom = "8px";
        this.infoBox.style.zIndex = "3";
        this.infoBox.style.padding = "2px 6px";
        this.infoBox.style.background = "rgba(255,255,255,0.85)";
        this.infoBox.style.font = "11px sans-serif";
        this.infoBox.style.display = "none";
        root.appendChild(this.infoBox);

        const initial = this.formattingSettings.map;
        this.mapManager = new MapManager(
            this.mapContainer,
            { styleUrl: initial.styleUrl.value, initialZoom: initial.initialZoom.value },
            (message) => this.showStatus(message),
            () => this.showStatus("")
        );
        const map = this.mapManager.getMap();
        this.projection = new ProjectionCache(map);
        this.flowRenderer = new FlowRenderer(this.svg, this.projection);
        this.renderOptions = this.computeRenderOptions();

        // Le cache de projection est enregistré avant : il est donc vidé avant chaque nouveau rendu.
        map.on("move", this.scheduleRender);
        map.on("resize", this.scheduleRender);
    }

    public update(options: VisualUpdateOptions): void {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews?.[0]
        );
        const m = this.formattingSettings.map;
        const { width, height } = options.viewport;
        this.svg.attr("width", width).attr("height", height);

        let linesRead = 0;
        let skipped = 0;
        let truncated = 0;
        let flowCount = 0;
        let drawn = 0;
        try {
            this.mapManager.applySettings({ styleUrl: m.styleUrl.value, initialZoom: m.initialZoom.value });
            this.mapManager.resize();

            const parsed = parseFlows(options.dataViews?.[0]);
            linesRead = parsed.rows.length;
            skipped = parsed.skipped;
            const maxFlows = clamp(Math.round(this.formattingSettings.arrows.maxFlows.value), 1, MAX_ROWS);
            const result = aggregateFlows(parsed.rows, maxFlows);
            truncated = result.truncated;
            flowCount = result.flows.length;
            this.flowRenderer.setFlows(result.flows);
            this.renderOptions = this.computeRenderOptions();

            // Recadrage automatique uniquement quand les flux affichés changent (données ou filtres).
            const signature = computeSignature(result.flows);
            if (m.autoZoom.value && result.flows.length > 0 && signature !== this.lastSignature) {
                try {
                    const points: Array<[number, number]> = [];
                    for (const f of result.flows) {
                        points.push([f.startLng, f.startLat], [f.endLng, f.endLat]);
                    }
                    this.mapManager.fitToPoints(points);
                } catch (e) {
                    this.showStatus(`Recadrage de la carte : ${errorMessage(e)}`);
                }
            }
            this.lastSignature = signature;

            drawn = this.flowRenderer.render(this.renderOptions);
        } catch (e) {
            this.showStatus(`Flux : ${errorMessage(e)}`);
        }
        this.updateInfo(linesRead, skipped, truncated, flowCount, drawn, width, height);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        const map = this.mapManager.getMap();
        map.off("move", this.scheduleRender);
        map.off("resize", this.scheduleRender);
        this.projection.dispose();
        this.mapManager.destroy();
    }

    private computeRenderOptions(): RenderOptions {
        const a = this.formattingSettings.arrows;
        return {
            color: a.color.value.value,
            opacity: clamp(a.opacity.value, 0, 100) / 100,
            curvature: clamp(a.curvature.value, 0, 60) / 100,
            thickness: PROVISIONAL_THICKNESS
        };
    }

    /** DIAGNOSTIC TEMPORAIRE : à retirer ou masquer une fois le rendu validé. */
    private updateInfo(
        linesRead: number,
        skipped: number,
        truncated: number,
        flowCount: number,
        drawn: number,
        width: number,
        height: number
    ): void {
        const zoom = this.mapManager.getMap().getZoom().toFixed(1);
        const opts = this.renderOptions;
        const parts: string[] = [
            `${linesRead} ligne(s) lue(s), ${flowCount} flux, ${drawn} tracé(s) | zoom ${zoom} | ${Math.round(width)}x${Math.round(height)} px | ${opts.color} opacité ${opts.opacity}`
        ];
        if (skipped > 0) {
            parts.push(`${skipped} ligne(s) ignorée(s) : coordonnées invalides`);
        }
        if (truncated > 0) {
            parts.push(`${truncated} flux non affiché(s) : limite atteinte`);
        }
        this.infoBox.textContent = parts.join(" — ");
        this.infoBox.style.display = "block";
    }

    private showStatus(message: string): void {
        this.statusBox.textContent = message;
        this.statusBox.style.display = message ? "block" : "none";
    }
}
