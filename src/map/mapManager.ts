/**
 * Gestion du fond cartographique MapLibre GL JS.
 * Le fournisseur de tuiles est entièrement piloté par l'URL de style (aucune clé codée en dur).
 */
import * as maplibregl from "maplibre-gl";
import { DEFAULT_STYLE_URL, DEFAULT_ZOOM } from "../settings";

export interface MapSettings {
    styleUrl: string;
    initialZoom: number;
}

/** Centre par défaut : France métropolitaine [longitude, latitude]. */
const DEFAULT_CENTER: [number, number] = [2.35, 46.6];

export class MapManager {
    private readonly map: maplibregl.Map;
    private currentStyleUrl: string;
    private currentZoom: number;

    constructor(container: HTMLElement, settings: MapSettings, onError: (message: string) => void, onLoad: () => void) {
        this.currentStyleUrl = settings.styleUrl || DEFAULT_STYLE_URL;
        this.currentZoom = settings.initialZoom || DEFAULT_ZOOM;
        this.map = new maplibregl.Map({
            container,
            style: this.currentStyleUrl,
            center: DEFAULT_CENTER,
            zoom: this.currentZoom
        });
        this.map.on("error", (e) => onError(e.error?.message ?? "Erreur de chargement de la carte"));
        this.map.on("load", () => onLoad());
    }

    public getMap(): maplibregl.Map {
        return this.map;
    }

    /** Applique les paramètres du panneau de formatage (style et zoom initial) s'ils ont changé. */
    public applySettings(settings: MapSettings): void {
        const styleUrl = settings.styleUrl || DEFAULT_STYLE_URL;
        if (styleUrl !== this.currentStyleUrl) {
            this.currentStyleUrl = styleUrl;
            this.map.setStyle(styleUrl);
        }
        const zoom = settings.initialZoom || DEFAULT_ZOOM;
        if (zoom !== this.currentZoom) {
            this.currentZoom = zoom;
            this.map.setZoom(zoom);
        }
    }

    /** À appeler quand la taille du visuel change. */
    public resize(): void {
        this.map.resize();
    }

    /** Cadre la carte sur un ensemble de points [longitude, latitude] (zoom automatique, utilisé dès l'étape 3). */
    public fitToPoints(points: Array<[number, number]>, padding: number = 40): void {
        if (points.length === 0) {
            return;
        }
        const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
        for (const p of points) {
            bounds.extend(p);
        }
        this.map.fitBounds(bounds, { padding, maxZoom: 15, duration: 0 });
    }

    public destroy(): void {
        this.map.remove();
    }
}
