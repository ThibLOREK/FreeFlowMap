/** Types de données partagés par le parseur, l'agrégateur et le rendu. */

/** Une ligne de la table Power BI, validée et typée. */
export interface FlowRow {
    rowIndex: number;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    value: number;
    flowId: string | null;
    category: string | null;
}

/** Résultat du parsing : lignes valides et nombre de lignes ignorées. */
export interface ParseResult {
    rows: FlowRow[];
    skipped: number;
}

/** Un flux à afficher (après agrégation éventuelle). Les coordonnées GPS ne sont jamais modifiées. */
export interface Flow {
    key: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    value: number;
    flowId: string | null;
    category: string | null;
    rowIndexes: number[];
}
