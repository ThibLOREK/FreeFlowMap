/**
 * Modèle du panneau de formatage : sections « Carte » et « Flèches ».
 * Les noms (name) doivent correspondre à ceux de capabilities.json.
 */
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

/** Style vectoriel gratuit sans clé API (OpenFreeMap). */
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_ZOOM = 5;
export const DEFAULT_ARROW_COLOR = "#1F77B4";

class MapCardSettings extends formattingSettings.SimpleCard {
    public styleUrl = new formattingSettings.TextInput({
        name: "styleUrl",
        displayName: "URL du style",
        value: DEFAULT_STYLE_URL,
        placeholder: DEFAULT_STYLE_URL
    });

    public initialZoom = new formattingSettings.NumUpDown({
        name: "initialZoom",
        displayName: "Zoom initial",
        value: DEFAULT_ZOOM
    });

    public autoZoom = new formattingSettings.ToggleSwitch({
        name: "autoZoom",
        displayName: "Zoom automatique",
        value: true
    });

    public name: string = "map";
    public displayName: string = "Carte";
    public slices: Array<formattingSettings.Slice> = [this.styleUrl, this.initialZoom, this.autoZoom];
}

class ArrowsCardSettings extends formattingSettings.SimpleCard {
    public color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Couleur",
        value: { value: DEFAULT_ARROW_COLOR }
    });

    /** En pourcentage (0 à 100). */
    public opacity = new formattingSettings.NumUpDown({
        name: "opacity",
        displayName: "Opacité (%)",
        value: 70
    });

    /** En pourcentage de la distance départ-arrivée (0 à 60). */
    public curvature = new formattingSettings.NumUpDown({
        name: "curvature",
        displayName: "Courbure (%)",
        value: 20
    });

    public maxFlows = new formattingSettings.NumUpDown({
        name: "maxFlows",
        displayName: "Nombre maximal de flux",
        value: 5000
    });

    public name: string = "arrows";
    public displayName: string = "Flèches";
    public slices: Array<formattingSettings.Slice> = [this.color, this.opacity, this.curvature, this.maxFlows];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public map = new MapCardSettings();
    public arrows = new ArrowsCardSettings();
    public cards = [this.map, this.arrows];
}
