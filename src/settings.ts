/**
 * Modèle du panneau de formatage : sections « Carte », « Flèches », « Étiquettes » et « Diagnostic ».
 * Les noms (name) doivent correspondre à ceux de capabilities.json.
 */
import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import type { ScaleMode } from "./flows/thicknessScale";

import IEnumMember = powerbi.IEnumMember;

/** Style vectoriel gratuit sans clé API (OpenFreeMap). */
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DEFAULT_ZOOM = 5;
export const DEFAULT_ARROW_COLOR = "#1F77B4";

const SCALE_ITEMS: IEnumMember[] = [
    { value: "sqrt", displayName: "Racine carrée" },
    { value: "linear", displayName: "Linéaire" },
    { value: "log", displayName: "Logarithmique" }
];

/** Convertit la valeur de la liste déroulante en mode d'échelle (racine carrée par défaut). */
export function readScaleMode(item: IEnumMember | undefined): ScaleMode {
    const v = item ? String(item.value) : "sqrt";
    return v === "linear" || v === "log" ? v : "sqrt";
}

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

    public minThickness = new formattingSettings.NumUpDown({
        name: "minThickness",
        displayName: "Épaisseur minimale (px)",
        value: 2
    });

    public maxThickness = new formattingSettings.NumUpDown({
        name: "maxThickness",
        displayName: "Épaisseur maximale (px)",
        value: 12
    });

    public scale = new formattingSettings.ItemDropdown({
        name: "scale",
        displayName: "Échelle d'épaisseur",
        items: SCALE_ITEMS,
        value: SCALE_ITEMS[0]
    });

    public maxFlows = new formattingSettings.NumUpDown({
        name: "maxFlows",
        displayName: "Nombre maximal de flux",
        value: 5000
    });

    public name: string = "arrows";
    public displayName: string = "Flèches";
    public slices: Array<formattingSettings.Slice> = [
        this.color,
        this.opacity,
        this.curvature,
        this.minThickness,
        this.maxThickness,
        this.scale,
        this.maxFlows
    ];
}

class LabelsCardSettings extends formattingSettings.SimpleCard {
    public show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Afficher les valeurs",
        value: true
    });

    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Taille du texte (px)",
        value: 11
    });

    public minLength = new formattingSettings.NumUpDown({
        name: "minLength",
        displayName: "Longueur minimale du flux (px)",
        value: 40
    });

    public name: string = "labels";
    public displayName: string = "Étiquettes";
    public slices: Array<formattingSettings.Slice> = [this.show, this.fontSize, this.minLength];
}

class DebugCardSettings extends formattingSettings.SimpleCard {
    public showDiagnostics = new formattingSettings.ToggleSwitch({
        name: "showDiagnostics",
        displayName: "Afficher le diagnostic",
        value: false
    });

    public name: string = "debug";
    public displayName: string = "Diagnostic";
    public slices: Array<formattingSettings.Slice> = [this.showDiagnostics];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public map = new MapCardSettings();
    public arrows = new ArrowsCardSettings();
    public labels = new LabelsCardSettings();
    public debug = new DebugCardSettings();
    public cards = [this.map, this.arrows, this.labels, this.debug];
}
