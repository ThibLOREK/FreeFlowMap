import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import * as maplibregl from "maplibre-gl";
import { WORKER_SOURCE } from "./workerSource";
import "../style/visual.less";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

export class Visual implements IVisual {
    constructor(options: VisualConstructorOptions) {
        const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
        maplibregl.setWorkerUrl(url);
        const div = document.createElement("div");
        options.element.appendChild(div);
        const map = new maplibregl.Map({ container: div, style: { version: 8, sources: {}, layers: [] } });
        d3.select(div).append("svg");
        void map;
    }
    public update(_o: VisualUpdateOptions) {}
}
