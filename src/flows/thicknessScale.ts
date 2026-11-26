/**
 * Échelle d'épaisseur des flèches, relative aux flux actuellement affichés.
 * épaisseur = min + (max - min) × f(valeur / valeur_max), avec f selon le mode :
 *  - "sqrt"   : racine carrée (défaut), équilibre petits et grands flux ;
 *  - "linear" : proportionnelle, accentue l'écart entre petits et grands flux ;
 *  - "log"    : logarithmique, aplatit les valeurs très dispersées.
 * Cas gérés : valeurs nulles ou négatives (épaisseur minimale), valeurs identiques (épaisseur médiane).
 */
export type ScaleMode = "sqrt" | "linear" | "log";

export interface ThicknessOptions {
    min: number;
    max: number;
    mode: ScaleMode;
}

function ratioFor(r: number, mode: ScaleMode): number {
    switch (mode) {
        case "linear":
            return r;
        case "log":
            // Normalisé pour que 0 -> 0 et 1 -> 1, indépendamment de l'ordre de grandeur des valeurs.
            return Math.log(1 + 9 * r) / Math.log(10);
        default:
            return Math.sqrt(r);
    }
}

/** Retourne une épaisseur (px) par valeur, dans le même ordre que `values`. */
export function computeThicknesses(values: number[], options: ThicknessOptions): number[] {
    const min = Math.max(0.5, options.min);
    const max = Math.max(min, options.max);

    let vmax = 0;
    let vminPositive = Infinity;
    for (const v of values) {
        if (Number.isFinite(v) && v > 0) {
            if (v > vmax) {
                vmax = v;
            }
            if (v < vminPositive) {
                vminPositive = v;
            }
        }
    }
    if (vmax <= 0) {
        return values.map(() => min);
    }
    // Toutes les valeurs positives sont identiques : épaisseur médiane pour éviter un affichage uniformément maximal.
    const allIdentical = vminPositive === vmax;
    const middle = (min + max) / 2;

    return values.map((v) => {
        if (!Number.isFinite(v) || v <= 0) {
            return min;
        }
        if (allIdentical) {
            return middle;
        }
        return min + (max - min) * ratioFor(v / vmax, options.mode);
    });
}
