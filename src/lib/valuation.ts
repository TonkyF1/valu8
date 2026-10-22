// Deterministic mock valuation generator for Valu8 (test mode)
import { PHOTO_SLOTS } from "./cars";


export interface ValuationInput {
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  serviceNotes?: string;
  photoCount: number;
}

export interface MotEntry {
  date: string;
  result: "Pass" | "Advisory" | "Fail";
  note: string;
  mileage: number;
  expiryDate?: string;
  advisories?: string[];
  failures?: string[];
  source?: "dvsa" | "simulated";
}
export type PhotoInsightSlot = "front" | "rear" | "side" | "interior" | "odometer" | "engine" | "other";
export type PhotoInsightSeverity = "positive" | "neutral" | "minor" | "notable";

export interface PhotoInsight {
  slot: PhotoInsightSlot;
  photoIndex?: number;
  observation: string;
  severity: PhotoInsightSeverity;
  priceImpact?: number; // GBP, negative for deductions, positive for value-adds
  fixCost?: number;     // GBP, estimated cost to remedy
  fixable?: boolean;
}

export interface ValuationReport {
  conditionScore: number;
  conditionLabel: string;
  values: { dealerTradeIn: number; privateSale: number; dealerRetail: number };
  valuationUnavailable?: boolean;
  valueRange?: { privateSaleLow: number; privateSaleHigh: number };
  valueReasoning?: string;
  marketConfidence?: "High" | "Medium" | "Low" | "Very Low";
  marketConfidenceReason?: string;
  pricingSource?: "marketcheck" | "ai_estimate";
  marketSampleSize?: number;
  priceAdjustments?: { label: string; impactPct: number }[];
  marketBaseline?: {
    source: "MarketCheck UK";
    sampleSize: number;
    baseDealerRetail: number;
    basePrivateSale: number;
    baseTradeIn: number;
    netAdjustmentPct: number;
  };
  comparableListings?: {
    price: number;
    mileage: number;
    year: number;
    trim?: string;
    location?: string;
    source?: string;
    url?: string;
  }[];
  marketAnchor?: number;
  expertInsight?: {
    shown: boolean;
    reason: string;
    sources: string[];
  };
  rareCarWarning?: string;
  honestAnalysis: string;
  marketPositioning: string;
  photoObservations?: string;
  photoInsights?: PhotoInsight[];
  headline?: string;
  marketContext?: string;
  factorsUp?: string[];
  factorsDown?: string[];
  sellerTip?: string;
  negotiationBuffer?: number;
  recommendedAskingPrice?: number;
  strengths: string[];
  watchPoints: string[];
  recommendations: { listingPrice: number; recommendedAskingPrice?: number; negotiationBuffer?: number; whereToSell: string[]; highlights: string[]; documents: string[] };
  hpi: { status: "All Clear" | "Needs Review" | "Not Checked"; checks: { label: string; ok: boolean }[] };
  motHistory: MotEntry[];
  motSource?: "dvsa" | "simulated" | "unavailable";
  motNotice?: string;
  generatedAt: string;
}

// The unused random mock generateValuation() was removed: all real valuations
// come from the analyse-vehicle edge function.
