import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Country, CountryInput, DurationMonths, PriceRecord, Tier } from "@/models";
import { nowIso } from "@/lib/utils";
import { logger } from "@/lib/logger";

function resolveDatabasePath() {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.K_SERVICE) {
    return "/tmp/ps-plus.db";
  }

  return "./data/ps-plus.db";
}

function resolveJsonFallbackPath(dbAbsPath: string) {
  if (dbAbsPath.endsWith(".db")) {
    return dbAbsPath.replace(/\.db$/, ".json");
  }
  return `${dbAbsPath}.json`;
}

const defaultCountries: CountryInput[] = [
  { name: "Argentina", isoCode: "AR", regionIdentifier: "es-ar", sourceUrl: "https://www.playstation.com/es-ar/ps-plus/" },
  { name: "Australia", isoCode: "AU", regionIdentifier: "en-au", sourceUrl: "https://www.playstation.com/en-au/ps-plus/" },
  { name: "Austria", isoCode: "AT", regionIdentifier: "de-at", sourceUrl: "https://www.playstation.com/de-at/ps-plus/" },
  { name: "Bahrain", isoCode: "BH", regionIdentifier: "ar-bh", sourceUrl: "https://www.playstation.com/ar-bh/ps-plus/" },
  { name: "Belgium", isoCode: "BE", regionIdentifier: "fr-be", sourceUrl: "https://www.playstation.com/fr-be/ps-plus/" },
  { name: "Bolivia", isoCode: "BO", regionIdentifier: "es-bo", sourceUrl: "https://www.playstation.com/es-bo/ps-plus/" },
  { name: "Brazil", isoCode: "BR", regionIdentifier: "pt-br", sourceUrl: "https://www.playstation.com/pt-br/ps-plus/" },
  { name: "Bulgaria", isoCode: "BG", regionIdentifier: "bg-bg", sourceUrl: "https://www.playstation.com/bg-bg/ps-plus/" },
  { name: "Canada", isoCode: "CA", regionIdentifier: "en-ca", sourceUrl: "https://www.playstation.com/en-ca/ps-plus/" },
  { name: "Chile", isoCode: "CL", regionIdentifier: "es-cl", sourceUrl: "https://www.playstation.com/es-cl/ps-plus/" },
  { name: "China", isoCode: "CN", regionIdentifier: "zh-hans-cn", sourceUrl: "https://www.playstation.com/zh-hans-cn/ps-plus/" },
  { name: "Colombia", isoCode: "CO", regionIdentifier: "es-co", sourceUrl: "https://www.playstation.com/es-co/ps-plus/" },
  { name: "Costa Rica", isoCode: "CR", regionIdentifier: "es-cr", sourceUrl: "https://www.playstation.com/es-cr/ps-plus/" },
  { name: "Croatia", isoCode: "HR", regionIdentifier: "en-hr", sourceUrl: "https://www.playstation.com/en-hr/ps-plus/" },
  { name: "Cyprus", isoCode: "CY", regionIdentifier: "en-cy", sourceUrl: "https://www.playstation.com/en-cy/ps-plus/" },
  { name: "Czechia", isoCode: "CZ", regionIdentifier: "en-cz", sourceUrl: "https://www.playstation.com/en-cz/ps-plus/" },
  { name: "Denmark", isoCode: "DK", regionIdentifier: "da-dk", sourceUrl: "https://www.playstation.com/da-dk/ps-plus/" },
  { name: "Ecuador", isoCode: "EC", regionIdentifier: "es-ec", sourceUrl: "https://www.playstation.com/es-ec/ps-plus/" },
  { name: "El Salvador", isoCode: "SV", regionIdentifier: "es-sv", sourceUrl: "https://www.playstation.com/es-sv/ps-plus/" },
  { name: "Finland", isoCode: "FI", regionIdentifier: "fi-fi", sourceUrl: "https://www.playstation.com/fi-fi/ps-plus/" },
  { name: "France", isoCode: "FR", regionIdentifier: "fr-fr", sourceUrl: "https://www.playstation.com/fr-fr/ps-plus/" },
  { name: "Germany", isoCode: "DE", regionIdentifier: "de-de", sourceUrl: "https://www.playstation.com/de-de/ps-plus/" },
  { name: "Greece", isoCode: "GR", regionIdentifier: "el-gr", sourceUrl: "https://www.playstation.com/el-gr/ps-plus/" },
  { name: "Guatemala", isoCode: "GT", regionIdentifier: "es-gt", sourceUrl: "https://www.playstation.com/es-gt/ps-plus/" },
  { name: "Honduras", isoCode: "HN", regionIdentifier: "es-hn", sourceUrl: "https://www.playstation.com/es-hn/ps-plus/" },
  { name: "Hong Kong SAR China", isoCode: "HK", regionIdentifier: "zh-hans-hk", sourceUrl: "https://www.playstation.com/zh-hans-hk/ps-plus/" },
  { name: "Hungary", isoCode: "HU", regionIdentifier: "hu-hu", sourceUrl: "https://www.playstation.com/hu-hu/ps-plus/" },
  { name: "Iceland", isoCode: "IS", regionIdentifier: "en-is", sourceUrl: "https://www.playstation.com/en-is/ps-plus/" },
  { name: "India", isoCode: "IN", regionIdentifier: "en-in", sourceUrl: "https://www.playstation.com/en-in/ps-plus/" },
  { name: "Indonesia", isoCode: "ID", regionIdentifier: "en-id", sourceUrl: "https://www.playstation.com/en-id/ps-plus/" },
  { name: "Ireland", isoCode: "IE", regionIdentifier: "en-ie", sourceUrl: "https://www.playstation.com/en-ie/ps-plus/" },
  { name: "Israel", isoCode: "IL", regionIdentifier: "he-il", sourceUrl: "https://www.playstation.com/he-il/ps-plus/" },
  { name: "Italy", isoCode: "IT", regionIdentifier: "it-it", sourceUrl: "https://www.playstation.com/it-it/ps-plus/" },
  { name: "Japan", isoCode: "JP", regionIdentifier: "ja-jp", sourceUrl: "https://www.playstation.com/ja-jp/ps-plus/" },
  { name: "Kuwait", isoCode: "KW", regionIdentifier: "ar-kw", sourceUrl: "https://www.playstation.com/ar-kw/ps-plus/" },
  { name: "Lebanon", isoCode: "LB", regionIdentifier: "ar-lb", sourceUrl: "https://www.playstation.com/ar-lb/ps-plus/" },
  { name: "Luxembourg", isoCode: "LU", regionIdentifier: "de-lu", sourceUrl: "https://www.playstation.com/de-lu/ps-plus/" },
  { name: "Malaysia", isoCode: "MY", regionIdentifier: "en-my", sourceUrl: "https://www.playstation.com/en-my/ps-plus/" },
  { name: "Malta", isoCode: "MT", regionIdentifier: "en-mt", sourceUrl: "https://www.playstation.com/en-mt/ps-plus/" },
  { name: "Mexico", isoCode: "MX", regionIdentifier: "es-mx", sourceUrl: "https://www.playstation.com/es-mx/ps-plus/" },
  { name: "Netherlands", isoCode: "NL", regionIdentifier: "nl-nl", sourceUrl: "https://www.playstation.com/nl-nl/ps-plus/" },
  { name: "New Zealand", isoCode: "NZ", regionIdentifier: "en-nz", sourceUrl: "https://www.playstation.com/en-nz/ps-plus/" },
  { name: "Nicaragua", isoCode: "NI", regionIdentifier: "es-ni", sourceUrl: "https://www.playstation.com/es-ni/ps-plus/" },
  { name: "Norway", isoCode: "NO", regionIdentifier: "en-no", sourceUrl: "https://www.playstation.com/en-no/ps-plus/" },
  { name: "Oman", isoCode: "OM", regionIdentifier: "ar-om", sourceUrl: "https://www.playstation.com/ar-om/ps-plus/" },
  { name: "Panama", isoCode: "PA", regionIdentifier: "es-pa", sourceUrl: "https://www.playstation.com/es-pa/ps-plus/" },
  { name: "Paraguay", isoCode: "PY", regionIdentifier: "es-py", sourceUrl: "https://www.playstation.com/es-py/ps-plus/" },
  { name: "Peru", isoCode: "PE", regionIdentifier: "es-pe", sourceUrl: "https://www.playstation.com/es-pe/ps-plus/" },
  { name: "Philippines", isoCode: "PH", regionIdentifier: "en-ph", sourceUrl: "https://www.playstation.com/en-ph/ps-plus/" },
  { name: "Poland", isoCode: "PL", regionIdentifier: "pl-pl", sourceUrl: "https://www.playstation.com/pl-pl/ps-plus/" },
  { name: "Portugal", isoCode: "PT", regionIdentifier: "pt-pt", sourceUrl: "https://www.playstation.com/pt-pt/ps-plus/" },
  { name: "Qatar", isoCode: "QA", regionIdentifier: "ar-qa", sourceUrl: "https://www.playstation.com/ar-qa/ps-plus/" },
  { name: "Romania", isoCode: "RO", regionIdentifier: "ro-ro", sourceUrl: "https://www.playstation.com/ro-ro/ps-plus/" },
  { name: "Saudi Arabia", isoCode: "SA", regionIdentifier: "ar-sa", sourceUrl: "https://www.playstation.com/ar-sa/ps-plus/" },
  { name: "Serbia", isoCode: "RS", regionIdentifier: "sr-rs", sourceUrl: "https://www.playstation.com/sr-rs/ps-plus/" },
  { name: "Singapore", isoCode: "SG", regionIdentifier: "en-sg", sourceUrl: "https://www.playstation.com/en-sg/ps-plus/" },
  { name: "Slovakia", isoCode: "SK", regionIdentifier: "en-sk", sourceUrl: "https://www.playstation.com/en-sk/ps-plus/" },
  { name: "Slovenia", isoCode: "SI", regionIdentifier: "sl-si", sourceUrl: "https://www.playstation.com/sl-si/ps-plus/" },
  { name: "South Africa", isoCode: "ZA", regionIdentifier: "en-za", sourceUrl: "https://www.playstation.com/en-za/ps-plus/" },
  { name: "South Korea", isoCode: "KR", regionIdentifier: "ko-kr", sourceUrl: "https://www.playstation.com/ko-kr/ps-plus/" },
  { name: "Spain", isoCode: "ES", regionIdentifier: "es-es", sourceUrl: "https://www.playstation.com/es-es/ps-plus/" },
  { name: "Sweden", isoCode: "SE", regionIdentifier: "en-se", sourceUrl: "https://www.playstation.com/en-se/ps-plus/" },
  { name: "Switzerland", isoCode: "CH", regionIdentifier: "fr-ch", sourceUrl: "https://www.playstation.com/fr-ch/ps-plus/" },
  { name: "Taiwan", isoCode: "TW", regionIdentifier: "en-tw", sourceUrl: "https://www.playstation.com/en-tw/ps-plus/" },
  { name: "Thailand", isoCode: "TH", regionIdentifier: "th-th", sourceUrl: "https://www.playstation.com/th-th/ps-plus/" },
  { name: "Türkiye", isoCode: "TR", regionIdentifier: "en-tr", sourceUrl: "https://www.playstation.com/en-tr/ps-plus/" },
  { name: "Ukraine", isoCode: "UA", regionIdentifier: "ru-ua", sourceUrl: "https://www.playstation.com/ru-ua/ps-plus/" },
  { name: "United Arab Emirates", isoCode: "AE", regionIdentifier: "ar-ae", sourceUrl: "https://www.playstation.com/ar-ae/ps-plus/" },
  { name: "United Kingdom", isoCode: "GB", regionIdentifier: "en-gb", sourceUrl: "https://www.playstation.com/en-gb/ps-plus/" },
  { name: "United States", isoCode: "US", regionIdentifier: "en-us", sourceUrl: "https://www.playstation.com/en-us/ps-plus/" },
  { name: "Uruguay", isoCode: "UY", regionIdentifier: "es-uy", sourceUrl: "https://www.playstation.com/es-uy/ps-plus/" },
  { name: "Vietnam", isoCode: "VN", regionIdentifier: "en-vn", sourceUrl: "https://www.playstation.com/en-vn/ps-plus/" }
];

type DbLike = {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  };
  pragma: (sql: string) => void;
  exec: (sql: string) => void;
  transaction: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
};

const dbPath = resolveDatabasePath();
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(absoluteDbPath), { recursive: true });

let db: DbLike | null = null;

try {
  const require = createRequire(import.meta.url);
  const BetterSqlite3 = require("better-sqlite3") as new (filename: string) => DbLike;
  db = new BetterSqlite3(absoluteDbPath);
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

CREATE TABLE IF NOT EXISTS country_sync_status (
  country_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
  error_message TEXT,
  synced_at TEXT NOT NULL,
  FOREIGN KEY(country_id) REFERENCES countries(id) ON DELETE CASCADE
);
`);

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
} catch (error) {
  db = null;
  logger.warn("SQLite unavailable, using JSON fallback store", { error });
}

type MemoryCountry = Country;
type MemoryPrice = PriceRecord & { cacheExpiresAt: string };

type MemoryStore = {
  nextCountryId: number;
  nextPriceId: number;
  countries: MemoryCountry[];
  prices: MemoryPrice[];
  syncStates: Record<number, { status: "ok" | "cached" | "error"; errorMessage: string | null; syncedAt: string }>;
};

const fallbackFile = resolveJsonFallbackPath(absoluteDbPath);
let memoryStore: MemoryStore | null = null;

function seedDefaultCountriesInMemory() {
  const ts = nowIso();
  if (!memoryStore) {
    return;
  }
  for (const c of defaultCountries) {
    memoryStore.countries.push({
      id: memoryStore.nextCountryId++,
      name: c.name,
      isoCode: c.isoCode,
      regionIdentifier: c.regionIdentifier,
      sourceUrl: c.sourceUrl ?? null,
      createdAt: ts,
      updatedAt: ts
    });
  }
}

function loadMemoryStore(): MemoryStore {
  if (memoryStore) {
    return memoryStore;
  }

  try {
    if (fs.existsSync(fallbackFile)) {
      const raw = fs.readFileSync(fallbackFile, "utf8");
      const parsed = JSON.parse(raw) as MemoryStore;
      memoryStore = parsed;
    } else {
      memoryStore = {
        nextCountryId: 1,
        nextPriceId: 1,
        countries: [],
        prices: [],
        syncStates: {}
      };
    }
  } catch (error) {
    logger.error("Failed reading fallback DB file, resetting memory store", { error });
    memoryStore = {
      nextCountryId: 1,
      nextPriceId: 1,
      countries: [],
      prices: [],
      syncStates: {}
    };
  }

  if (memoryStore.countries.length === 0) {
    seedDefaultCountriesInMemory();
    persistMemoryStore();
  }

  if (!memoryStore.syncStates) {
    memoryStore.syncStates = {};
    persistMemoryStore();
  }

  return memoryStore;
}

function persistMemoryStore() {
  if (!memoryStore) {
    return;
  }
  try {
    fs.writeFileSync(fallbackFile, JSON.stringify(memoryStore));
  } catch (error) {
    logger.error("Failed writing fallback DB file", { error });
  }
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
  if (!db) {
    const store = loadMemoryStore();
    return [...store.countries].sort((a, b) => a.name.localeCompare(b.name));
  }

  const rows = db.prepare("SELECT * FROM countries ORDER BY name ASC").all() as Record<string, unknown>[];
  return rows.map(mapCountry);
}

export function getCountryById(id: number): Country | null {
  if (!db) {
    const store = loadMemoryStore();
    return store.countries.find((c) => c.id === id) ?? null;
  }

  const row = db.prepare("SELECT * FROM countries WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapCountry(row) : null;
}

export function getCountryByIso(isoCode: string): Country | null {
  if (!db) {
    const store = loadMemoryStore();
    const target = isoCode.toUpperCase();
    return store.countries.find((c) => c.isoCode.toUpperCase() === target) ?? null;
  }

  const row = db.prepare("SELECT * FROM countries WHERE iso_code = ?").get(isoCode) as Record<string, unknown> | undefined;
  return row ? mapCountry(row) : null;
}

export function insertCountry(input: CountryInput): Country {
  if (!db) {
    const store = loadMemoryStore();
    const targetIso = input.isoCode.toUpperCase();
    const exists = store.countries.some((c) => c.isoCode.toUpperCase() === targetIso);
    if (exists) {
      throw { code: "SQLITE_CONSTRAINT_UNIQUE", message: "Country with this ISO code already exists" };
    }

    const ts = nowIso();
    const created: Country = {
      id: store.nextCountryId++,
      name: input.name,
      isoCode: targetIso,
      regionIdentifier: input.regionIdentifier,
      sourceUrl: input.sourceUrl ?? null,
      createdAt: ts,
      updatedAt: ts
    };
    store.countries.push(created);
    persistMemoryStore();
    return created;
  }

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
  if (!db) {
    const store = loadMemoryStore();
    const ts = nowIso();
    let inserted = 0;

    for (const row of inputs) {
      const targetIso = row.isoCode.toUpperCase();
      const exists = store.countries.some((c) => c.isoCode.toUpperCase() === targetIso);
      if (exists) {
        continue;
      }

      store.countries.push({
        id: store.nextCountryId++,
        name: row.name,
        isoCode: targetIso,
        regionIdentifier: row.regionIdentifier,
        sourceUrl: row.sourceUrl ?? null,
        createdAt: ts,
        updatedAt: ts
      });
      inserted += 1;
    }

    if (inserted > 0) {
      persistMemoryStore();
    }
    return inserted;
  }

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
  if (!db) {
    const store = loadMemoryStore();
    const countryBefore = store.countries.length;
    store.countries = store.countries.filter((c) => c.id !== id);
    if (store.countries.length === countryBefore) {
      return false;
    }
    store.prices = store.prices.filter((p) => p.countryId !== id);
    delete store.syncStates[id];
    persistMemoryStore();
    return true;
  }

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

export function upsertCountrySyncStatus(
  countryId: number,
  input: { status: "ok" | "cached" | "error"; errorMessage?: string | null; syncedAt: string }
) {
  if (!db) {
    const store = loadMemoryStore();
    store.syncStates[countryId] = {
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      syncedAt: input.syncedAt
    };
    persistMemoryStore();
    return;
  }

  db.prepare(
    `
      INSERT INTO country_sync_status (country_id, status, error_message, synced_at)
      VALUES (@countryId, @status, @errorMessage, @syncedAt)
      ON CONFLICT(country_id)
      DO UPDATE SET
        status = excluded.status,
        error_message = excluded.error_message,
        synced_at = excluded.synced_at
    `
  ).run({
    countryId,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    syncedAt: input.syncedAt
  });
}

export function upsertPrices(entries: UpsertPriceInput[]) {
  if (!db) {
    const store = loadMemoryStore();

    for (const row of entries) {
      const idx = store.prices.findIndex(
        (p) => p.countryId === row.countryId && p.tier === row.tier && p.durationMonths === row.durationMonths
      );

      if (idx >= 0) {
        const prev = store.prices[idx];
        store.prices[idx] = {
          ...prev,
          currency: row.currency,
          price: row.price,
          sourceUrl: row.sourceUrl ?? null,
          lastUpdated: row.lastUpdated,
          cacheExpiresAt: row.cacheExpiresAt
        };
      } else {
        const country = store.countries.find((c) => c.id === row.countryId);
        store.prices.push({
          id: store.nextPriceId++,
          countryId: row.countryId,
          countryName: country?.name ?? "Unknown",
          isoCode: country?.isoCode ?? "",
          currency: row.currency,
          tier: row.tier,
          durationMonths: row.durationMonths,
          price: row.price,
          sourceUrl: row.sourceUrl ?? null,
          lastUpdated: row.lastUpdated,
          cacheExpiresAt: row.cacheExpiresAt
        });
      }
    }

    persistMemoryStore();
    return;
  }

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
  if (!db) {
    const store = loadMemoryStore();
    const targetCountry = filters?.country?.toUpperCase();
    const currency = filters?.currency;
    const tier = filters?.tier;
    const duration = filters?.duration;
    const search = filters?.search?.toLowerCase();

    let rows = store.prices.filter((p) => {
      if (targetCountry && p.isoCode.toUpperCase() !== targetCountry) {
        return false;
      }
      if (currency && p.currency !== currency) {
        return false;
      }
      if (tier && p.tier !== tier) {
        return false;
      }
      if (duration && p.durationMonths !== duration) {
        return false;
      }
      if (
        search &&
        !(p.countryName.toLowerCase().includes(search) ||
          p.isoCode.toLowerCase().includes(search) ||
          p.currency.toLowerCase().includes(search) ||
          p.tier.toLowerCase().includes(search))
      ) {
        return false;
      }
      return true;
    });

    const sortBy = filters?.sortBy ?? "country";
    const factor = filters?.sortDir === "desc" ? -1 : 1;

    rows = rows.sort((a, b) => {
      if (sortBy === "price") {
        return (a.price - b.price) * factor;
      }
      if (sortBy === "lastUpdated") {
        return a.lastUpdated.localeCompare(b.lastUpdated) * factor;
      }
      return a.countryName.localeCompare(b.countryName) * factor;
    });

    return rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      countryName: row.countryName,
      isoCode: row.isoCode,
      currency: row.currency,
      tier: row.tier,
      durationMonths: row.durationMonths,
      price: row.price,
      lastUpdated: row.lastUpdated,
      sourceUrl: row.sourceUrl,
      syncStatus: store.syncStates[row.countryId]?.status ?? null,
      syncError: store.syncStates[row.countryId]?.errorMessage ?? null,
      syncedAt: store.syncStates[row.countryId]?.syncedAt ?? null
    }));
  }

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
        p.source_url,
        s.status AS sync_status,
        s.error_message AS sync_error,
        s.synced_at AS synced_at
      FROM prices p
      JOIN countries c ON c.id = p.country_id
      LEFT JOIN country_sync_status s ON s.country_id = c.id
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
    sourceUrl: row.source_url ? String(row.source_url) : null,
    syncStatus:
      row.sync_status === "ok" || row.sync_status === "cached" || row.sync_status === "error"
        ? row.sync_status
        : null,
    syncError: row.sync_error ? String(row.sync_error) : null,
    syncedAt: row.synced_at ? String(row.synced_at) : null
  }));
}

export function getCountryPriceSnapshot(countryId: number) {
  if (!db) {
    const store = loadMemoryStore();
    return store.prices
      .filter((p) => p.countryId === countryId)
      .sort((a, b) => a.tier.localeCompare(b.tier) || a.durationMonths - b.durationMonths)
      .map((p) => ({
        id: p.id,
        country_id: p.countryId,
        currency: p.currency,
        tier: p.tier,
        duration_months: p.durationMonths,
        price: p.price,
        source_url: p.sourceUrl,
        last_updated: p.lastUpdated,
        cache_expires_at: p.cacheExpiresAt
      }));
  }

  return db
    .prepare(
      "SELECT * FROM prices WHERE country_id = ? ORDER BY tier ASC, duration_months ASC"
    )
    .all(countryId) as Array<Record<string, unknown>>;
}

export function areCountryPricesFresh(countryId: number, now = nowIso()) {
  if (!db) {
    const store = loadMemoryStore();
    const entries = store.prices.filter((p) => p.countryId === countryId);
    if (entries.length === 0) {
      return false;
    }

    const minExpiry = entries.reduce((min, curr) => (curr.cacheExpiresAt < min ? curr.cacheExpiresAt : min), entries[0].cacheExpiresAt);
    return minExpiry > now;
  }

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

export function getDbMode() {
  return db ? "sqlite" : "json";
}
