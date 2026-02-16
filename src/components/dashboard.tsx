"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { Globe, Layers, Sparkles, Timer } from "lucide-react";
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
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/components/language-provider";

type SortBy = "sarPrice" | "country" | "lastUpdated";
type SortDir = "asc" | "desc";
type ViewMode = "subscriptions" | "games";

export function Dashboard() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { language } = useLanguage();
  const isAr = language === "ar";
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
  const [viewMode, setViewMode] = useState<ViewMode>("subscriptions");

  const copy = isAr
    ? {
        badge: "لوحة ذكية",
        title: "PlayStation Plus Price Tracker",
        subtitle: "مركز موحّد لمقارنة الأسعار عالميًا مع تحويل دقيق إلى الريال السعودي.",
        subscriptions: "الاشتراكات",
        games: "الألعاب",
        refreshClient: "تحديث الكل (محلي)",
        refreshServer: "تحديث الكل (سيرفر)",
        loading: "جاري تحميل اللوحة...",
        rows: "عدد الصفوف",
        countries: "عدد الدول",
        minSar: "أقل سعر SAR",
        lastUpdate: "آخر تحديث",
        searchPlaceholder: "ابحث بالدولة أو ISO أو الباقة أو العملة",
        allCurrencies: "كل العملات",
        allTiers: "كل الباقات",
        tierEssential: "أساسي",
        tierExtra: "إكسترا",
        tierPremium: "بريميوم",
        allDurations: "كل المدد",
        oneMonth: "شهر",
        threeMonths: "3 أشهر",
        twelveMonths: "12 شهر",
        sortCountry: "ترتيب: الدولة",
        sortSar: "ترتيب: سعر SAR",
        sortUpdated: "ترتيب: آخر تحديث",
        lowHigh: "من الأقل للأعلى",
        highLow: "من الأعلى للأقل",
        done: "تم",
        refreshAll: "تحديث كل الدول...",
        initialSync: "بدء المزامنة الأولى...",
        syncLabel: "مزامنة",
        refreshFailed: "فشل تحديث الكل",
        initialSyncFailed: "فشلت المزامنة الأولى",
        deleteFailed: "فشل الحذف",
        singleRefreshFailed: "فشل تحديث الدولة"
      }
    : {
        badge: "Intelligence Hub",
        title: "PlayStation Plus Price Tracker",
        subtitle: "A unified command center for global price comparison with precise SAR conversion.",
        subscriptions: "Subscriptions",
        games: "Games",
        refreshClient: "Refresh All (client)",
        refreshServer: "Refresh All (server)",
        loading: "Loading dashboard...",
        rows: "Rows",
        countries: "Countries",
        minSar: "Lowest SAR",
        lastUpdate: "Last Update",
        searchPlaceholder: "Search by country, ISO, tier, or currency",
        allCurrencies: "All currencies",
        allTiers: "All tiers",
        tierEssential: "Essential",
        tierExtra: "Extra",
        tierPremium: "Premium",
        allDurations: "All durations",
        oneMonth: "1 month",
        threeMonths: "3 months",
        twelveMonths: "12 months",
        sortCountry: "Sort: Country",
        sortSar: "Sort: Saudi Price",
        sortUpdated: "Sort: Updated",
        lowHigh: "Low->High",
        highLow: "High->Low",
        done: "Done",
        refreshAll: "Refreshing all countries...",
        initialSync: "First sync started...",
        syncLabel: "First sync",
        refreshFailed: "Refresh all failed",
        initialSyncFailed: "Initial sync failed",
        deleteFailed: "Delete failed",
        singleRefreshFailed: "Refresh failed"
      };

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
        if (!target.includes(search.toLowerCase())) return false;
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
    return Array.from(new Set((pricesQuery.data ?? []).map((r) => r.currency))).sort();
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
      setError(e instanceof Error ? e.message : copy.deleteFailed);
    }
  }

  async function handleRefreshCountry(countryId: number) {
    setError("");
    setRefreshingCountryId(countryId);
    try {
      await refreshCountry(countryId, true);
      await qc.invalidateQueries({ queryKey: ["prices"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.singleRefreshFailed);
    } finally {
      setRefreshingCountryId(null);
    }
  }

  async function handleRefreshAll() {
    setError("");
    const countries = countriesQuery.data ?? [];

    for (let i = 0; i < countries.length; i += 1) {
      const c = countries[i];
      setRefreshProgress(`${copy.syncLabel} ${c.isoCode} (${i + 1}/${countries.length})`);
      await refreshCountry(c.id, true);
    }

    setRefreshProgress(copy.done);
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
    setRefreshProgress(copy.refreshAll);
    try {
      await runBatchedRefresh(copy.syncLabel);
      await qc.invalidateQueries({ queryKey: ["prices"] });
      setRefreshProgress(copy.done);
      setTimeout(() => setRefreshProgress(""), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.refreshFailed);
      setRefreshProgress("");
    }
  }

  useEffect(() => {
    if (!shellRef.current) return;

    const tl = gsap.timeline();
    tl.fromTo(
      shellRef.current.querySelectorAll("[data-hero-item]"),
      { opacity: 0, y: 24, filter: "blur(6px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, stagger: 0.08, ease: "power3.out" }
    );
  }, []);

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
    setRefreshProgress(copy.initialSync);

    void (async () => {
      try {
        await runBatchedRefresh(copy.syncLabel);
        await qc.invalidateQueries({ queryKey: ["prices"] });
        setRefreshProgress(copy.done);
        setTimeout(() => setRefreshProgress(""), 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : copy.initialSyncFailed);
        setRefreshProgress("");
      }
    })();
  }, [didAutoBootstrap, pricesQuery.isLoading, countriesQuery.isLoading, pricesQuery.data, countriesQuery.data, qc, copy.initialSync, copy.syncLabel, copy.done, copy.initialSyncFailed]);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 18, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, ease: "power3.out" }
    );
  }, [viewMode]);

  if (pricesQuery.isLoading || countriesQuery.isLoading) {
    return <div className="p-8 text-sm text-[var(--muted)]">{copy.loading}</div>;
  }

  const rows = filteredRows as PriceRecord[];

  return (
    <main ref={shellRef} className="neo-shell mx-auto max-w-[1600px] px-3 py-5 sm:px-6 lg:px-8">
      <div className="neo-layout">
        <aside className="neo-sidebar card" data-hero-item>
          <span className="neo-kicker">{copy.badge}</span>
          <h1 className="neo-title">{copy.title}</h1>
          <p className="neo-copy">{copy.subtitle}</p>

          <div className="neo-switch">
            <button
              type="button"
              className={viewMode === "subscriptions" ? "primary-btn !w-full !text-xs" : "soft-btn !w-full !text-xs"}
              onClick={() => setViewMode("subscriptions")}
            >
              {copy.subscriptions}
            </button>
            <button
              type="button"
              className={viewMode === "games" ? "primary-btn !w-full !text-xs" : "soft-btn !w-full !text-xs"}
              onClick={() => setViewMode("games")}
            >
              {copy.games}
            </button>
          </div>

          <div className="neo-tools">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          <div className="neo-quick-grid">
            <article className="neo-mini-card">
              <span><Layers size={14} /> {copy.rows}</span>
              <strong>{stats.rows}</strong>
            </article>
            <article className="neo-mini-card">
              <span><Globe size={14} /> {copy.countries}</span>
              <strong>{stats.countries}</strong>
            </article>
            <article className="neo-mini-card">
              <span><Sparkles size={14} /> {copy.minSar}</span>
              <strong>{typeof stats.minSar === "number" ? stats.minSar.toFixed(2) : "-"}</strong>
            </article>
            <article className="neo-mini-card">
              <span><Timer size={14} /> {copy.lastUpdate}</span>
              <strong className="!text-xs">{stats.latest ? new Date(stats.latest).toLocaleString() : "-"}</strong>
            </article>
          </div>
        </aside>

        <section ref={contentRef} className="neo-content">
          <div className="neo-actions card">
            <CountryForm
              onSubmit={async (input) => {
                await addCountryMutation.mutateAsync(input);
              }}
            />
            <button type="button" onClick={handleRefreshAll} className="soft-btn">
              {copy.refreshClient}
            </button>
            <button type="button" onClick={handleSmartRefreshAll} className="primary-btn">
              {copy.refreshServer}
            </button>
          </div>

          {viewMode === "subscriptions" ? (
            <>
              <section className="neo-filters card">
                <input
                  className="soft-input neo-search"
                  placeholder={copy.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <div className="neo-filter-grid">
                  <select className="soft-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="all">{copy.allCurrencies}</option>
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select className="soft-select" value={tier} onChange={(e) => setTier(e.target.value)}>
                    <option value="all">{copy.allTiers}</option>
                    <option value="Essential">{copy.tierEssential}</option>
                    <option value="Extra">{copy.tierExtra}</option>
                    <option value="Premium">{copy.tierPremium}</option>
                  </select>

                  <select className="soft-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="all">{copy.allDurations}</option>
                    <option value="1">{copy.oneMonth}</option>
                    <option value="3">{copy.threeMonths}</option>
                    <option value="12">{copy.twelveMonths}</option>
                  </select>

                  <select className="soft-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                    <option value="country">{copy.sortCountry}</option>
                    <option value="sarPrice">{copy.sortSar}</option>
                    <option value="lastUpdated">{copy.sortUpdated}</option>
                  </select>

                  <button
                    type="button"
                    className="soft-btn whitespace-nowrap"
                    onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                  >
                    {sortDir === "asc" ? copy.lowHigh : copy.highLow}
                  </button>
                </div>
              </section>

              <section className="neo-table card">
                <PriceTable
                  rows={rows}
                  refreshingCountryId={refreshingCountryId}
                  onRefreshCountry={handleRefreshCountry}
                  onDeleteCountry={handleDeleteCountry}
                />
              </section>
            </>
          ) : (
            <GameSearchSection />
          )}

          {refreshProgress ? <p className="status-pill">{refreshProgress}</p> : null}
          {error ? <p className="alert-error">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
