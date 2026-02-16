export type Tier = "Essential" | "Extra" | "Premium";

export type DurationMonths = 1 | 3 | 12;

export interface Country {
  id: number;
  name: string;
  isoCode: string;
  regionIdentifier: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceRecord {
  id: number;
  countryId: number;
  countryName: string;
  isoCode: string;
  currency: string;
  isLocalCurrency?: boolean;
  localCurrencyCodes?: string[];
  localEstimatedPrice?: number | null;
  tier: Tier;
  durationMonths: DurationMonths;
  price: number;
  sarPrice?: number | null;
  lastUpdated: string;
  sourceUrl: string | null;
}

export interface CountryInput {
  name: string;
  isoCode: string;
  regionIdentifier: string;
  sourceUrl?: string;
}

export interface RefreshResult {
  countryId: number;
  isoCode: string;
  updated: number;
  status: "ok" | "cached" | "error";
  message?: string;
}

export interface GamePriceRecord {
  countryId: number;
  countryName: string;
  isoCode: string;
  gameName: string;
  posterUrl?: string | null;
  productType: string;
  productId: string;
  currency: string | null;
  amount: number | null;
  displayPrice: string;
  sarPrice: number | null;
  sourceUrl: string;
}
