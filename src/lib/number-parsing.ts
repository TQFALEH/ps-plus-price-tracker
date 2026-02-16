export function parseLocalizedNumber(input: string): number | null {
  // Keep digits and common separators used by localized prices.
  let value = input
    .replace(/\u00A0/g, " ")
    .replace(/[\s]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!value) {
    return null;
  }

  const sign = value.startsWith("-") ? "-" : "";
  value = value.replace(/-/g, "");

  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  const normalizeWithDecimal = (decimalSep: "," | ".") => {
    const thousandsSep = decimalSep === "," ? "." : ",";
    const noThousands = value.split(thousandsSep).join("");
    if (decimalSep === ",") {
      return noThousands.replace(",", ".");
    }
    return noThousands;
  };

  // If both separators exist, choose decimal by the rightmost separator when it has 1-3 digits after it.
  // 3 digits is important for currencies with milli-units and some storefront formats.
  if (hasComma && hasDot) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    const rightmostPos = Math.max(lastComma, lastDot);
    const rightmostSep = value[rightmostPos] as "," | ".";
    const digitsAfter = value.length - rightmostPos - 1;

    if (digitsAfter >= 1 && digitsAfter <= 3) {
      value = normalizeWithDecimal(rightmostSep);
    } else {
      // No decimal part; treat all separators as thousands separators.
      value = value.replace(/[.,]/g, "");
    }
  } else if (hasComma) {
    // Comma only:
    // - decimal if it ends with 1-2 digits and there is only one comma
    // - otherwise treat commas as thousands separators.
    if (/,\d{1,2}$/.test(value) && value.indexOf(",") === value.lastIndexOf(",")) {
      value = value.replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (hasDot) {
    // Dot only:
    // - decimal if it ends with 1-2 digits and there is only one dot
    // - otherwise treat dots as thousands separators.
    if (/\.\d{1,2}$/.test(value) && value.indexOf(".") === value.lastIndexOf(".")) {
      value = value;
    } else {
      value = value.replace(/\./g, "");
    }
  }

  const parsed = Number(sign + value);
  return Number.isFinite(parsed) ? parsed : null;
}
