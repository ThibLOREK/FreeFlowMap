import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import * as maplibregl from "maplibre-gl";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { WORKER_SOURCE } from "./workerSource";
import { VisualFormattingSettingsModel } from "./settings";
import { MapManager } from "./map/mapManager";
import { ProjectionCache } from "./map/projection";
import "../style/visual.less";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

let workerConfigured = false;

/** Le worker MapLibre est embarqué dans le bundle et servi via une URL blob: (un visuel = un seul fichier). */
function configureWorker(): void {
    if (workerConfigured) {
        return;
    }
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    maplibregl.setWorkerUrl(url);
    workerConfigured = true;
}

export class Visual implements IVisual {
    private readonly formattingSettingsService: FormattingSettingsService;
    private formattingSettings: VisualFormattingSettingsModel;
    private readonly mapContainer: HTMLDivElement;
    private readonly statusBox: HTMLDivElement;
    private readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private readonly mapManager: MapManager;
    private readonly projection: ProjectionCache;

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
        root.appendChild(this.mapContainer);

        this.svg = d3.select(root).append("svg");
        this.svg
            .style("position", "absolute")
            .style("left", "0")
            .style("top", "0")
            .style("pointer-events", "none");

        this.statusBox = document.createElement("div");
        this.statusBox.style.position = "absolute";
        this.statusBox.style.left = "8px";
        this.statusBox.style.top = "8px";
        this.statusBox.style.padding = "4px 8px";
        this.statusBox.style.background = "rgba(255,255,255,0.9)";
        this.statusBox.style.font = "12px sans-serif";
        this.statusBox.style.display = "none";
        root.appendChild(this.statusBox);

        const initial = this.formattingSettings.map;
        this.mapManager = new MapManager(
            this.mapContainer,
            { styleUrl: initial.styleUrl.value, initialZoom: initial.initialZoom.value },
            (message) => this.showStatus(message),
            () => this.showStatus("")
        );
        this.projection = new ProjectionCache(this.mapManager.getMap());
    }

    public update(options: VisualUpdateOptions): void {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews?.[0]
        );
        const m = this.formattingSettings.map;
        this.mapManager.applySettings({ styleUrl: m.styleUrl.value, initialZoom: m.initialZoom.value });

        const { width, height } = options.viewport;
        this.svg.attr("width", width).attr("height", height);
        this.mapManager.resize();
        // Étape 3 : parser les flux, projeter via this.projection et les dessiner dans this.svg.
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        this.projection.dispose();
        this.mapManager.destroy();
    }

    private showStatus(message: string): void {
        this.statusBox.textContent = message;
        this.statusBox.style.display = message ? "block" : "none";
    }
}
