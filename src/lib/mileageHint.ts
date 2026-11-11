/** Hint under the mileage box explaining what the DVSA record did (or couldn't) fill in. */
export interface MileageLookup { lastMileage?: number; lastMileageDate?: string; firstRegistered?: string; motTestCount?: number }

const month = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export function mileageHint(l: MileageLookup, now = new Date()): string {
  if (l.lastMileage) {
    const when = l.lastMileageDate ? ` (${month(l.lastMileageDate)})` : "";
    return `From the last MOT${when}: ${l.lastMileage.toLocaleString("en-GB")} mi. Update it if it's gone up.`;
  }
  const reg = l.firstRegistered ? new Date(l.firstRegistered) : null;
  if (reg && !Number.isNaN(reg.getTime()) && !l.motTestCount) {
    const due = new Date(reg); due.setUTCFullYear(due.getUTCFullYear() + 3);
    if (due > now) return `No MOT yet (first one due ${month(due.toISOString())}), so there's no recorded mileage. Enter it from the dashboard.`;
  }
  return "The MOT record has no mileage reading for this car. Enter it from the dashboard.";
}
