"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CountryInput, PriceRecord } from "@/models";
import {
  addCountry,
  getCountries,
  getPrices,
  refreshAll,
  refreshCountry,
  removeCountry
} from "@/lib/api-client";
import { CountryForm } from "@/components/country-form";
import { PriceTable } from "@/components/price-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { GameSearchSection } from "@/components/game-search-section";

type SortBy = "sarPrice" | "country" | "lastUpdated";
type SortDir = "asc" | "desc";

export function Dashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("all");
  const [tier, setTier] = useState("all");
  const [duration, setDuration] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("sarPrice");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [refreshingCountryId, setRefreshingCountryId] = useState<number | null>(null);
  const [refreshProgress, setRefreshProgress] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [didAutoBootstrap, setDidAutoBootstrap] = useState(false);

  const pricesQuery = useQuery({
    queryKey: ["prices"],
    queryFn: getPrices
  });

  const countriesQuery = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries
  });

  const addCountryMutation = useMutation({
    mutationFn: (input: CountryInput) => addCountry(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["countries"] }),
        qc.invalidateQueries({ queryKey: ["prices"] })
      ]);
    }
  });

  const filteredRows = useMemo(() => {
    const rows = pricesQuery.data ?? [];

    const searched = rows.filter((row) => {
      if (search) {
        const target = `${row.countryName} ${row.isoCode} ${row.currency} ${row.tier}`.toLowerCase();
        if (!target.includes(search.toLowerCase())) {
          return false;
        }
      }
      if (currency !== "all" && row.currency !== currency) return false;
      if (tier !== "all" && row.tier !== tier) return false;
      if (duration !== "all" && String(row.durationMonths) !== duration) return false;
      return true;
    });

    return [...searched].sort((a, b) => {
      let diff = 0;
      if (sortBy === "sarPrice") {
        const aSar = typeof a.sarPrice === "number" ? a.sarPrice : Number.POSITIVE_INFINITY;
        const bSar = typeof b.sarPrice === "number" ? b.sarPrice : Number.POSITIVE_INFINITY;
        diff = aSar - bSar;
      } else if (sortBy === "lastUpdated") {
        diff = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
      } else {
        diff = a.countryName.localeCompare(b.countryName);
      }
      return sortDir === "asc" ? diff : -diff;
    });
  }, [pricesQuery.data, search, currency, tier, duration, sortBy, sortDir]);

  const currencyOptions = useMemo(() => {
    const set = new Set((pricesQuery.data ?? []).map((r) => r.currency));
    return Array.from(set).sort();
  }, [pricesQuery.data]);

  const stats = useMemo(() => {
    const rows = filteredRows;
    const minSar = rows
      .map((r) => r.sarPrice)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b)[0];
    const latest = rows
      .map((r) => new Date(r.lastUpdated).getTime())
      .sort((a, b) => b - a)[0];

    return {
      rows: rows.length,
      countries: (countriesQuery.data ?? []).length,
      minSar,
      latest
    };
  }, [filteredRows, countriesQuery.data]);

  async function handleDeleteCountry(countryId: number) {
    setError("");
    try {
      await removeCountry(countryId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["countries"] }),
        qc.invalidateQueries({ queryKey: ["prices"] })
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function handleRefreshCountry(countryId: number) {
    setError("");
    setRefreshingCountryId(countryId);
    try {
      await refreshCountry(countryId, true);
      await qc.invalidateQueries({ queryKey: ["prices"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshingCountryId(null);
    }
  }

  async function handleRefreshAll() {
    setError("");
    const countries = countriesQuery.data ?? [];

    for (let i = 0; i < countries.length; i += 1) {
      const c = countries[i];
      setRefreshProgress(`Refreshing ${c.isoCode} (${i + 1}/${countries.length})`);
      await refreshCountry(c.id, true);
    }

    setRefreshProgress("Done");
    await qc.invalidateQueries({ queryKey: ["prices"] });
    setTimeout(() => setRefreshProgress(""), 1200);
  }

  async function runBatchedRefresh(labelPrefix: string) {
    const batchSize = 5;
    let offset = 0;
    let done = false;

    while (!done) {
      const result = await refreshAll(true, { offset, limit: batchSize });
      const from = result.offset + 1;
      const to = result.offset + result.processed;
      setRefreshProgress(`${labelPrefix} ${from}-${to} / ${result.total}`);
      offset = result.nextOffset ?? 0;
      done = result.done;
    }
  }

  async function handleSmartRefreshAll() {
    setError("");
    setRefreshProgress("Refreshing all countries...");
    try {
      await runBatchedRefresh("Refreshing");
      await qc.invalidateQueries({ queryKey: ["prices"] });
      setRefreshProgress("Done");
      setTimeout(() => setRefreshProgress(""), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh all failed");
      setRefreshProgress("");
    }
  }

  useEffect(() => {
    if (didAutoBootstrap) return;
    if (pricesQuery.isLoading || countriesQuery.isLoading) return;

    const countriesCount = (countriesQuery.data ?? []).length;
    const pricesCount = (pricesQuery.data ?? []).length;
    if (countriesCount === 0) return;

    if (pricesCount > 0) {
      setDidAutoBootstrap(true);
      return;
    }

    setDidAutoBootstrap(true);
    setError("");
    setRefreshProgress("First sync started...");

    void (async () => {
      try {
        await runBatchedRefresh("First sync");
        await qc.invalidateQueries({ queryKey: ["prices"] });
        setRefreshProgress("Done");
        setTimeout(() => setRefreshProgress(""), 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Initial sync failed");
        setRefreshProgress("");
      }
    })();
  }, [didAutoBootstrap, pricesQuery.isLoading, countriesQuery.isLoading, pricesQuery.data, countriesQuery.data, qc]);

  if (pricesQuery.isLoading || countriesQuery.isLoading) {
    return <div className="p-8 text-sm text-[var(--muted)]">Loading dashboard...</div>;
  }

  const rows = filteredRows as PriceRecord[];

  return (
    <main className="mx-auto max-w-[1500px] px-3 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">PlayStation Intelligence</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">PlayStation Plus Price Tracker</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Live regional prices, smart currency normalization, and Saudi conversion.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <CountryForm
              onSubmit={async (input) => {
                await addCountryMutation.mutateAsync(input);
              }}
            />
            <button type="button" onClick={handleRefreshAll} className="soft-btn">
              Refresh All (client)
            </button>
            <button type="button" onClick={handleSmartRefreshAll} className="primary-btn">
              Refresh All (server)
            </button>
          </div>
        </div>
      </header>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Rows</p>
          <p className="mt-1 text-2xl font-bold">{stats.rows}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Countries</p>
          <p className="mt-1 text-2xl font-bold">{stats.countries}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Lowest SAR</p>
          <p className="mt-1 text-2xl font-bold">{typeof stats.minSar === "number" ? stats.minSar.toFixed(2) : "-"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Last Update</p>
          <p className="mt-1 text-sm font-semibold">{stats.latest ? new Date(stats.latest).toLocaleString() : "-"}</p>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            className="soft-input xl:col-span-2"
            placeholder="Search country, ISO, tier, currency"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="soft-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="all">All currencies</option>
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select className="soft-select" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="Essential">Essential</option>
            <option value="Extra">Extra</option>
            <option value="Premium">Premium</option>
          </select>

          <select className="soft-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="all">All durations</option>
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="12">12 months</option>
          </select>

          <div className="flex gap-2">
            <select className="soft-select flex-1" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="country">Sort: Country</option>
              <option value="sarPrice">Sort: Saudi Price</option>
              <option value="lastUpdated">Sort: Updated</option>
            </select>
            <button
              type="button"
              className="soft-btn whitespace-nowrap"
              onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              {sortDir === "asc" ? "Low->High" : "High->Low"}
            </button>
          </div>
        </div>
      </section>

      <GameSearchSection />

      {refreshProgress ? (
        <p className="mb-3 inline-flex rounded-full border border-sky-200 bg-sky-100/60 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-900/20 dark:text-sky-300">
          {refreshProgress}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <PriceTable
        rows={rows}
        refreshingCountryId={refreshingCountryId}
        onRefreshCountry={handleRefreshCountry}
        onDeleteCountry={handleDeleteCountry}
      />
    </main>
  );
}
