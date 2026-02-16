"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PriceRecord } from "@/models";
import { useLanguage } from "@/components/language-provider";

interface PriceTableProps {
  rows: PriceRecord[];
  refreshingCountryId: number | null;
  onRefreshCountry: (countryId: number) => Promise<void>;
  onDeleteCountry: (countryId: number) => Promise<void>;
}

const columns = [
  "Country",
  "ISO",
  "Currency",
  "Tier",
  "Duration",
  "Price",
  "Last Updated",
  "Source",
  "Actions"
] as const;

const numberFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatDuration(months: number) {
  if (months === 12) return "12 months";
  if (months === 3) return "3 months";
  return "1 month";
}

function formatAmount(value: number) {
  return numberFormatter.format(value);
}

function isoToFlag(isoCode: string) {
  const code = isoCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🏳️";
  }
  return String.fromCodePoint(...Array.from(code).map((char) => 127397 + char.charCodeAt(0)));
}

export function PriceTable({
  rows,
  refreshingCountryId,
  onRefreshCountry,
  onDeleteCountry
}: PriceTableProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const parentRef = useRef<HTMLDivElement>(null);

  const uniqueCountryIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of rows) ids.add(row.countryId);
    return ids;
  }, [rows]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10
  });

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden max-md:hidden">
        <div className="grid grid-cols-9 gap-2 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {(isAr
            ? ["الدولة", "ISO", "العملة", "الباقة", "المدة", "السعر", "آخر تحديث", "المصدر", "الإجراءات"]
            : columns
          ).map((col) => (
            <div key={col}>{col}</div>
          ))}
        </div>

        <div ref={parentRef} className="max-h-[62vh] overflow-auto">
          <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isRefreshing = refreshingCountryId === row.countryId;

              return (
                <div
                  key={row.id}
                  className="absolute left-0 top-0 grid w-full grid-cols-9 gap-2 border-b px-4 py-3 text-sm"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="truncate font-semibold">
                    <span className="mr-2" aria-hidden="true">
                      {isoToFlag(row.isoCode)}
                    </span>
                    {row.countryName}
                  </div>
                  <div className="text-[var(--muted)]">{row.isoCode}</div>
                  <div>
                    <div>{row.currency}</div>
                    {row.isLocalCurrency === false ? (
                      <span className="chip mt-1 border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400">
                        {isAr ? "إقليمي" : "Regional"}
                      </span>
                    ) : null}
                  </div>
                  <div>{row.tier}</div>
                  <div>{formatDuration(row.durationMonths)}</div>
                  <div>
                    <div className="font-semibold">
                      {formatAmount(row.price)} {row.currency}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {typeof row.sarPrice === "number"
                        ? `≈ ${formatAmount(row.sarPrice)} SAR`
                        : isAr ? "SAR غير متاح" : "SAR unavailable"}
                    </div>
                    {row.isLocalCurrency === false &&
                    typeof row.localEstimatedPrice === "number" &&
                    row.localCurrencyCodes &&
                    row.localCurrencyCodes.length > 0 ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        ~ {formatAmount(row.localEstimatedPrice)} {row.localCurrencyCodes[0]} {isAr ? "(تقريبي)" : "(est.)"}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--muted)]">{new Date(row.lastUpdated).toLocaleString()}</div>
                  <a
                    className="truncate text-xs text-[var(--accent)] hover:underline"
                    href={row.sourceUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.sourceUrl ? "Source" : "N/A"}
                  </a>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onRefreshCountry(row.countryId)}
                      disabled={isRefreshing}
                      className="soft-btn !px-2 !py-1 !text-xs disabled:opacity-60"
                    >
                      {isRefreshing ? "..." : isAr ? "تحديث" : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCountry(row.countryId)}
                      className="soft-btn !px-2 !py-1 !text-xs border-red-200 text-red-500 dark:border-red-900"
                    >
                      {isAr ? "حذف" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const isRefreshing = refreshingCountryId === row.countryId;
          return (
            <article key={row.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold">
                  <span className="mr-2" aria-hidden="true">
                    {isoToFlag(row.isoCode)}
                  </span>
                  {row.countryName}
                </h3>
                <span className="chip">{row.isoCode}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-[var(--muted)]">{isAr ? "الباقة" : "Tier"}</div>
                <div>{row.tier}</div>
                <div className="text-[var(--muted)]">{isAr ? "المدة" : "Duration"}</div>
                <div>{formatDuration(row.durationMonths)}</div>
                <div className="text-[var(--muted)]">{isAr ? "العملة" : "Currency"}</div>
                <div>
                  {row.currency}
                  {row.isLocalCurrency === false ? (
                    <span className="chip ml-2 border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400">
                      {isAr ? "إقليمي" : "Regional"}
                    </span>
                  ) : null}
                </div>
                <div className="text-[var(--muted)]">{isAr ? "السعر" : "Price"}</div>
                <div className="font-semibold">
                  {formatAmount(row.price)} {row.currency}
                </div>
                <div className="text-[var(--muted)]">{isAr ? "السعر بالريال" : "Saudi Price"}</div>
                <div>
                  {typeof row.sarPrice === "number" ? `${formatAmount(row.sarPrice)} SAR` : isAr ? "غير متاح" : "N/A"}
                </div>
                {row.isLocalCurrency === false &&
                typeof row.localEstimatedPrice === "number" &&
                row.localCurrencyCodes &&
                row.localCurrencyCodes.length > 0 ? (
                  <>
                    <div className="text-[var(--muted)]">{isAr ? "تقدير محلي" : "Local Estimate"}</div>
                    <div>
                      {formatAmount(row.localEstimatedPrice)} {row.localCurrencyCodes[0]}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onRefreshCountry(row.countryId)}
                  disabled={isRefreshing}
                  className="soft-btn flex-1 disabled:opacity-60"
                >
                  {isRefreshing ? (isAr ? "جاري التحديث..." : "Refreshing...") : (isAr ? "تحديث" : "Refresh")}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCountry(row.countryId)}
                  className="soft-btn flex-1 border-red-200 text-red-500 dark:border-red-900"
                >
                  {isAr ? "حذف" : "Delete"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="border-t px-1 py-2 text-xs text-[var(--muted)]">
        {isAr
          ? `${rows.length} صف عبر ${uniqueCountryIds.size} دولة`
          : `${rows.length} rows across ${uniqueCountryIds.size} countries`}
      </div>
    </div>
  );
}
