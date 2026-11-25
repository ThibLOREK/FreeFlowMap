/**
 * Modèle du panneau de formatage (section « Carte » pour l'étape 2).
 * Les noms (name) doivent correspondre à ceux de capabilities.json.
 */
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

/** Style vectoriel gratuit sans clé API (OpenFreeMap). */
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_ZOOM = 5;

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

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public map = new MapCardSettings();
    public cards = [this.map];
}
