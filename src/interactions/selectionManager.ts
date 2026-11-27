/**
 * Sélection des flux via le gestionnaire de sélection de Power BI (cross-filtering des autres visuels).
 * Un flux agrégé correspond à plusieurs lignes de la table : le sélectionner sélectionne toutes ses lignes.
 * Limite : le mapping "table" ne prend pas en charge le surlignage (cross-highlighting) ; seul le filtrage fonctionne.
 */
import powerbi from "powerbi-visuals-api";
import { Flow } from "../data/types";

import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataViewTable = powerbi.DataViewTable;

export class FlowSelection {
    private readonly manager: ISelectionManager;
    private readonly idsByKey = new Map<string, ISelectionId[]>();
    private readonly selectedKeys = new Set<string>();

    /** @param onChange appelé quand la sélection change (clic ou sélection venant de l'extérieur, ex. signet). */
    constructor(
        private readonly host: IVisualHost,
        private readonly onChange: () => void
    ) {
        this.manager = host.createSelectionManager();
        this.manager.registerOnSelectCallback((ids: ISelectionId[]) => {
            this.sync(ids);
            this.onChange();
        });
    }

    /** Recrée les identifiants de sélection pour les flux affichés (à appeler à chaque mise à jour des données). */
    public setFlows(table: DataViewTable | undefined, flows: Flow[]): void {
        this.idsByKey.clear();
        if (table) {
            for (const flow of flows) {
                const ids = flow.rowIndexes.map((rowIndex) =>
                    this.host.createSelectionIdBuilder().withTable(table, rowIndex).createSelectionId()
                );
                this.idsByKey.set(flow.key, ids);
            }
        }
        this.sync(this.manager.getSelectionIds() as ISelectionId[]);
    }

    public getSelectedKeys(): Set<string> {
        return this.selectedKeys;
    }

    /** @param multi true pour ajouter ou retirer le flux de la sélection courante (Ctrl, Maj ou Cmd + clic). */
    public select(key: string, multi: boolean): void {
        const ids = this.idsByKey.get(key);
        if (!ids || ids.length === 0) {
            return;
        }
        void this.manager.select(ids, multi).then((selected: ISelectionId[]) => {
            this.sync(selected);
            this.onChange();
        });
    }

    public clear(): void {
        if (this.selectedKeys.size === 0) {
            return;
        }
        void this.manager.clear().then(() => {
            this.selectedKeys.clear();
            this.onChange();
        });
    }

    /** Menu contextuel natif de Power BI. Pour un flux agrégé, seule la première ligne d'origine est transmise. */
    public showContextMenu(key: string | null, x: number, y: number): void {
        const ids = key !== null ? this.idsByKey.get(key) : undefined;
        void this.manager.showContextMenu(ids && ids.length > 0 ? ids[0] : {}, { x, y });
    }

    private sync(selected: ISelectionId[]): void {
        this.selectedKeys.clear();
        if (!selected || selected.length === 0) {
            return;
        }
        this.idsByKey.forEach((ids, key) => {
            if (ids.some((id) => selected.some((s) => s.equals(id)))) {
                this.selectedKeys.add(key);
            }
        });
    }
}
