/**
 * Central date formatting helpers.
 * The whole application displays dates as DD/MM/YYYY.
 */

const pad = (n: number) => String(n).padStart(2, "0");

const toDate = (value: string | number | Date | null | undefined): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  // Plain YYYY-MM-DD strings must not be shifted by timezone.
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/** DD/MM/YYYY */
export const fmtDate = (value: string | number | Date | null | undefined, fallback = ""): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** DD/MM/YYYY, hh:mm am/pm */
export const fmtDateTime = (value: string | number | Date | null | undefined, fallback = ""): string => {
  const d = toDate(value);
  if (!d) return fallback;
  let h = d.getHours();
  const suffix = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${fmtDate(d)}, ${pad(h)}:${pad(d.getMinutes())} ${suffix}`;
};

/** hh:mm am/pm */
export const fmtTime = (value: string | number | Date | null | undefined, fallback = ""): string => {
  const d = toDate(value);
  if (!d) return fallback;
  let h = d.getHours();
  const suffix = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())} ${suffix}`;
};

/** DD-MM-YYYY — safe for filenames */
export const fmtDateFile = (value: string | number | Date | null | undefined): string =>
  fmtDate(value).replace(/\//g, "-");

export const DATE_FORMAT_HINT = "DD/MM/YYYY";
