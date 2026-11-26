/**
 * Formatage compact des valeurs affichées près des flèches (ex. « 1,2 k »), selon la langue de Power BI.
 */
export function createValueFormatter(locale: string): (value: number) => string {
    const options: Intl.NumberFormatOptions = { notation: "compact", maximumFractionDigits: 1 };
    let formatter: Intl.NumberFormat;
    try {
        formatter = new Intl.NumberFormat(locale, options);
    } catch {
        formatter = new Intl.NumberFormat(undefined, options);
    }
    return (value: number): string => formatter.format(value);
}
