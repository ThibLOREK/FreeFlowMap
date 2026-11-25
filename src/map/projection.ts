/**
 * Projection GPS -> pixels via la carte MapLibre, avec cache.
 * Le cache est vidé à chaque changement de vue (déplacement, zoom, redimensionnement).
 * Les coordonnées GPS ne sont jamais modifiées.
 */
import type { Map as MapLibreMap } from "maplibre-gl";

export interface PixelPoint {
    x: number;
    y: number;
}

export class ProjectionCache {
    private readonly cache = new Map<string, PixelPoint>();
    private readonly invalidate = (): void => {
        this.cache.clear();
    };

    constructor(private readonly map: MapLibreMap) {
        // "move" est aussi émis pendant les zooms et les rotations.
        this.map.on("move", this.invalidate);
        this.map.on("resize", this.invalidate);
    }

    public project(lng: number, lat: number): PixelPoint {
        const key = `${lng},${lat}`;
        let point = this.cache.get(key);
        if (!point) {
            const p = this.map.project([lng, lat]);
            point = { x: p.x, y: p.y };
            this.cache.set(key, point);
        }
        return point;
    }

    public dispose(): void {
        this.map.off("move", this.invalidate);
        this.map.off("resize", this.invalidate);
        this.cache.clear();
    }
}
