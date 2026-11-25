/**
 * Lit la table du dataView Power BI et produit des lignes de flux typées.
 * Les lignes sans coordonnées valides sont ignorées (et comptées).
 */
import powerbi from "powerbi-visuals-api";
import { FlowRow, ParseResult } from "./types";

import DataView = powerbi.DataView;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

function findColumn(columns: DataViewMetadataColumn[], role: string): number {
    return columns.findIndex((c) => c.roles !== undefined && c.roles[role] === true);
}

function toNumber(v: PrimitiveValue): number {
    if (typeof v === "number") {
        return v;
    }
    if (typeof v === "string") {
        const text = v.trim();
        return text === "" ? NaN : Number(text.replace(",", "."));
    }
    return NaN;
}

function toText(v: PrimitiveValue): string | null {
    return v === null || v === undefined ? null : String(v);
}

function validLat(n: number): boolean {
    return Number.isFinite(n) && n >= -90 && n <= 90;
}

function validLng(n: number): boolean {
    return Number.isFinite(n) && n >= -180 && n <= 180;
}

export function parseFlows(dataView: DataView | undefined): ParseResult {
    const table = dataView?.table;
    if (!table || !table.rows || !table.columns) {
        return { rows: [], skipped: 0 };
    }
    const cols = table.columns;
    const iLatStart = findColumn(cols, "latStart");
    const iLngStart = findColumn(cols, "lonStart");
    const iLatEnd = findColumn(cols, "latEnd");
    const iLngEnd = findColumn(cols, "lonEnd");
    const iValue = findColumn(cols, "value");
    const iId = findColumn(cols, "flowId");
    const iCategory = findColumn(cols, "category");

    // Les 4 coordonnées sont obligatoires : sans elles, rien à afficher.
    if (iLatStart < 0 || iLngStart < 0 || iLatEnd < 0 || iLngEnd < 0) {
        return { rows: [], skipped: 0 };
    }

    const rows: FlowRow[] = [];
    let skipped = 0;
    table.rows.forEach((row, rowIndex) => {
        const startLat = toNumber(row[iLatStart]);
        const startLng = toNumber(row[iLngStart]);
        const endLat = toNumber(row[iLatEnd]);
        const endLng = toNumber(row[iLngEnd]);
        if (!validLat(startLat) || !validLng(startLng) || !validLat(endLat) || !validLng(endLng)) {
            skipped++;
            return;
        }
        // Valeur absente => 1 ; valeur non numérique => 0.
        let value = 1;
        if (iValue >= 0) {
            const n = toNumber(row[iValue]);
            value = Number.isFinite(n) ? n : 0;
        }
        rows.push({
            rowIndex,
            startLat,
            startLng,
            endLat,
            endLng,
            value,
            flowId: iId >= 0 ? toText(row[iId]) : null,
            category: iCategory >= 0 ? toText(row[iCategory]) : null
        });
    });
    return { rows, skipped };
}
