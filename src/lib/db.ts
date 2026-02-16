import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Country, CountryInput, DurationMonths, PriceRecord, Tier } from "@/models";
import { nowIso } from "@/lib/utils";

function resolveDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  // Most serverless platforms allow writes only under /tmp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.K_SERVICE) {
    return "/tmp/ps-plus.db";
  }

  return "./data/ps-plus.db";
}

const dbPath = resolveDatabasePath();
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

fs.mkdirSync(path.dirname(absoluteDbPath), { recursive: true });

const db = new Database(absoluteDbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  iso_code TEXT NOT NULL UNIQUE,
  region_identifier TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER NOT NULL,
  currency TEXT NOT NULL,
  tier TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price REAL NOT NULL,
  source_url TEXT,
  last_updated TEXT NOT NULL,
  cache_expires_at TEXT NOT NULL,
  UNIQUE(country_id, tier, duration_months),
  FOREIGN KEY(country_id) REFERENCES countries(id) ON DELETE CASCADE
);
`);

const defaultCountries: CountryInput[] = [
  { name: "United States", isoCode: "US", regionIdentifier: "en-us", sourceUrl: "https://www.playstation.com/en-us/ps-plus/" },
  { name: "United Kingdom", isoCode: "GB", regionIdentifier: "en-gb", sourceUrl: "https://www.playstation.com/en-gb/ps-plus/" },
  { name: "Canada", isoCode: "CA", regionIdentifier: "en-ca", sourceUrl: "https://www.playstation.com/en-ca/ps-plus/" },
  { name: "Japan", isoCode: "JP", regionIdentifier: "ja-jp", sourceUrl: "https://www.playstation.com/ja-jp/ps-plus/" },
  { name: "Germany", isoCode: "DE", regionIdentifier: "de-de", sourceUrl: "https://www.playstation.com/de-de/ps-plus/" },
  { name: "France", isoCode: "FR", regionIdentifier: "fr-fr", sourceUrl: "https://www.playstation.com/fr-fr/ps-plus/" },
  { name: "Spain", isoCode: "ES", regionIdentifier: "es-es", sourceUrl: "https://www.playstation.com/es-es/ps-plus/" },
  { name: "Italy", isoCode: "IT", regionIdentifier: "it-it", sourceUrl: "https://www.playstation.com/it-it/ps-plus/" },
  { name: "Australia", isoCode: "AU", regionIdentifier: "en-au", sourceUrl: "https://www.playstation.com/en-au/ps-plus/" },
  { name: "Brazil", isoCode: "BR", regionIdentifier: "pt-br", sourceUrl: "https://www.playstation.com/pt-br/ps-plus/" }
];

const existingCount = db.prepare("SELECT COUNT(*) as count FROM countries").get() as { count: number };
if (existingCount.count === 0) {
  const insert = db.prepare(
    "INSERT INTO countries (name, iso_code, region_identifier, source_url, created_at, updated_at) VALUES (@name, @isoCode, @regionIdentifier, @sourceUrl, @createdAt, @updatedAt)"
  );
  const ts = nowIso();
  const tx = db.transaction((items: CountryInput[]) => {
    for (const c of items) {
      insert.run({ ...c, createdAt: ts, updatedAt: ts, sourceUrl: c.sourceUrl ?? null });
    }
  });
  tx(defaultCountries);
}

function mapCountry(row: Record<string, unknown>): Country {
  return {
    id: Number(row.id),
    name: String(row.name),
    isoCode: String(row.iso_code),
    regionIdentifier: String(row.region_identifier),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function listCountries(): Country[] {
  const rows = db.prepare("SELECT * FROM countries ORDER BY name ASC").all() as Record<string, unknown>[];
  return rows.map(mapCountry);
}

export function getCountryById(id: number): Country | null {
  const row = db.prepare("SELECT * FROM countries WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapCountry(row) : null;
}

export function getCountryByIso(isoCode: string): Country | null {
  const row = db.prepare("SELECT * FROM countries WHERE iso_code = ?").get(isoCode) as Record<string, unknown> | undefined;
  return row ? mapCountry(row) : null;
}

export function insertCountry(input: CountryInput): Country {
  const ts = nowIso();
  const stmt = db.prepare(
    "INSERT INTO countries (name, iso_code, region_identifier, source_url, created_at, updated_at) VALUES (@name, @isoCode, @regionIdentifier, @sourceUrl, @createdAt, @updatedAt)"
  );
  const result = stmt.run({
    ...input,
    sourceUrl: input.sourceUrl ?? null,
    createdAt: ts,
    updatedAt: ts
  });
  return getCountryById(Number(result.lastInsertRowid)) as Country;
}

export function insertCountriesIfMissing(inputs: CountryInput[]): number {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO countries (name, iso_code, region_identifier, source_url, created_at, updated_at) VALUES (@name, @isoCode, @regionIdentifier, @sourceUrl, @createdAt, @updatedAt)"
  );
  const ts = nowIso();
  let inserted = 0;

  const tx = db.transaction((rows: CountryInput[]) => {
    for (const row of rows) {
      const res = stmt.run({
        ...row,
        sourceUrl: row.sourceUrl ?? null,
        createdAt: ts,
        updatedAt: ts
      });
      inserted += res.changes;
    }
  });

  tx(inputs);
  return inserted;
}

export function deleteCountry(id: number): boolean {
  const res = db.prepare("DELETE FROM countries WHERE id = ?").run(id);
  return res.changes > 0;
}

export interface UpsertPriceInput {
  countryId: number;
  currency: string;
  tier: Tier;
  durationMonths: DurationMonths;
  price: number;
  sourceUrl?: string | null;
  lastUpdated: string;
  cacheExpiresAt: string;
}

export function upsertPrices(entries: UpsertPriceInput[]) {
  const stmt = db.prepare(`
    INSERT INTO prices (country_id, currency, tier, duration_months, price, source_url, last_updated, cache_expires_at)
    VALUES (@countryId, @currency, @tier, @durationMonths, @price, @sourceUrl, @lastUpdated, @cacheExpiresAt)
    ON CONFLICT(country_id, tier, duration_months)
    DO UPDATE SET
      currency = excluded.currency,
      price = excluded.price,
      source_url = excluded.source_url,
      last_updated = excluded.last_updated,
      cache_expires_at = excluded.cache_expires_at
  `);

  const tx = db.transaction((rows: UpsertPriceInput[]) => {
    for (const row of rows) {
      stmt.run({ ...row, sourceUrl: row.sourceUrl ?? null });
    }
  });

  tx(entries);
}

export function getPrices(filters?: {
  country?: string;
  currency?: string;
  tier?: string;
  duration?: number;
  search?: string;
  sortBy?: "price" | "country" | "lastUpdated";
  sortDir?: "asc" | "desc";
}): PriceRecord[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.country) {
    where.push("c.iso_code = @country");
    params.country = filters.country;
  }
  if (filters?.currency) {
    where.push("p.currency = @currency");
    params.currency = filters.currency;
  }
  if (filters?.tier) {
    where.push("p.tier = @tier");
    params.tier = filters.tier;
  }
  if (filters?.duration) {
    where.push("p.duration_months = @duration");
    params.duration = filters.duration;
  }
  if (filters?.search) {
    where.push("(c.name LIKE @search OR c.iso_code LIKE @search OR p.currency LIKE @search OR p.tier LIKE @search)");
    params.search = `%${filters.search}%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sortFieldMap = {
    price: "p.price",
    country: "c.name",
    lastUpdated: "p.last_updated"
  };
  const sortField = sortFieldMap[filters?.sortBy ?? "country"];
  const sortDir = filters?.sortDir === "desc" ? "DESC" : "ASC";

  const rows = db
    .prepare(
      `
      SELECT
        p.id,
        p.country_id,
        c.name AS country_name,
        c.iso_code,
        p.currency,
        p.tier,
        p.duration_months,
        p.price,
        p.last_updated,
        p.source_url
      FROM prices p
      JOIN countries c ON c.id = p.country_id
      ${whereClause}
      ORDER BY ${sortField} ${sortDir}
      `
    )
    .all(params) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    countryId: Number(row.country_id),
    countryName: String(row.country_name),
    isoCode: String(row.iso_code),
    currency: String(row.currency),
    tier: row.tier as Tier,
    durationMonths: Number(row.duration_months) as DurationMonths,
    price: Number(row.price),
    lastUpdated: String(row.last_updated),
    sourceUrl: row.source_url ? String(row.source_url) : null
  }));
}

export function getCountryPriceSnapshot(countryId: number) {
  return db
    .prepare(
      "SELECT * FROM prices WHERE country_id = ? ORDER BY tier ASC, duration_months ASC"
    )
    .all(countryId) as Array<Record<string, unknown>>;
}

export function areCountryPricesFresh(countryId: number, now = nowIso()) {
  const row = db
    .prepare(
      "SELECT MIN(cache_expires_at) as min_expiry, COUNT(*) as count FROM prices WHERE country_id = ?"
    )
    .get(countryId) as { min_expiry: string | null; count: number };

  if (!row || row.count === 0 || !row.min_expiry) {
    return false;
  }

  return row.min_expiry > now;
}
