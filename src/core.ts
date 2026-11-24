// Core NHTSA vPIC VIN decoder, Recalls, Complaints, and 5-Star NCAP Safety Ratings logic.
import type { FetchText } from './types.js';

export const REPO = 'nhtsa-vehicle-recalls-vin-mcp';
export const SITE = 'https://www.mcpstamp.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const BUNDLE_URL = `https://mcp.zovo.one/bundle?src=sat.${REPO}`;
export const SERVICES_URL = `https://www.mcpstamp.com/services/?src=sat.${REPO}`;
export const MORE_URL = `${SITE}/free-servers/?${UTM}`;
export const VPIC_API = 'https://vpic.nhtsa.dot.gov/api/vehicles';
export const NHTSA_API = 'https://api.nhtsa.gov';

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

export function normalizeVin(raw: string): string {
  const vin = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new InputError(
      `Invalid VIN "${raw}". A standard VIN must be 17 alphanumeric characters (excluding I, O, and Q).`
    );
  }
  return vin;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === 'Not Applicable' || s === 'null') return null;
  return s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson<T>(fetchText: FetchText, url: string, cacheTtl = 1800): Promise<T> {
  const raw = await fetchText(url, { cacheTtl });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('NHTSA API returned invalid JSON');
  }
}

interface VehicleKey {
  make: string;
  model: string;
  model_year: number;
  vin?: string;
}

async function decodeVinCore(fetchText: FetchText, rawVin: string, modelYearHint?: number) {
  const vin = normalizeVin(rawVin);
  const qs = new URLSearchParams({ format: 'json' });
  if (modelYearHint !== undefined) qs.set('modelyear', String(modelYearHint));
  const url = `${VPIC_API}/DecodeVinValues/${encodeURIComponent(vin)}?${qs.toString()}`;
  const data = await fetchJson<{ Results?: Array<Record<string, string>> }>(fetchText, url, 86400);
  const r = data.Results?.[0];
  if (!r) throw new Error('NHTSA vPIC returned no result for VIN.');

  const make = clean(r.Make);
  const model = clean(r.Model);
  const year = num(r.ModelYear);

  return {
    vin,
    make,
    model,
    model_year: year,
    trim: clean(r.Trim) ?? clean(r.Series),
    body_class: clean(r.BodyClass),
    vehicle_type: clean(r.VehicleType),
    doors: num(r.Doors),
    drive_type: clean(r.DriveType),
    transmission: clean(r.TransmissionStyle),
    engine_cylinders: num(r.EngineCylinders),
    engine_displacement_l: clean(r.DisplacementL),
    engine_hp: clean(r.EngineHP),
    fuel_type: clean(r.FuelTypePrimary),
    electrification_level: clean(r.ElectrificationLevel),
    gvwr: clean(r.GVWR),
    manufacturer: clean(r.Manufacturer),
    plant_city: clean(r.PlantCity),
    plant_state: clean(r.PlantState),
    plant_country: clean(r.PlantCountry),
    safety_equipment: {
      abs: clean(r.ABS),
      esc: clean(r.ESC),
      traction_control: clean(r.TractionControl),
      forward_collision_warning: clean(r.ForwardCollisionWarning),
      lane_departure_warning: clean(r.LaneDepartureWarning),
      blind_spot_monitoring: clean(r.BlindSpotMon),
      backup_camera: clean(r.RearVisibilitySystem),
      airbag_front: clean(r.AirBagLocFront),
      airbag_side: clean(r.AirBagLocSide),
      airbag_curtain: clean(r.AirBagLocCurtain),
    },
    error_code: clean(r.ErrorCode),
    error_text: clean(r.ErrorText),
  };
}

async function resolveVehicle(
  fetchText: FetchText,
  args: { vin?: string; make?: string; model?: string; model_year?: number }
): Promise<VehicleKey> {
  if (args.vin?.trim()) {
    const d = await decodeVinCore(fetchText, args.vin, args.model_year);
    if (!d.make || !d.model || !d.model_year) {
      throw new InputError(`Could not decode make, model, and year from VIN ${d.vin}. Provide make, model, and model_year explicitly.`);
    }
    return { make: d.make, model: d.model, model_year: d.model_year, vin: d.vin };
  }
  if (!args.make?.trim() || !args.model?.trim() || !args.model_year) {
    throw new InputError('Provide either a 17-character vin, OR make, model, and model_year.');
  }
  return {
    make: args.make.trim(),
    model: args.model.trim(),
    model_year: args.model_year,
  };
}

export interface DecodeVinArgs {
  vin: string;
  model_year?: number;
  include_recalls?: boolean;
}

export async function nhtsaDecodeVin(fetchText: FetchText, args: DecodeVinArgs) {
  const decoded = await decodeVinCore(fetchText, args.vin, args.model_year);

  let recallsSummary: { count: number; park_it_count: number; park_outside_count: number; campaigns: string[] } | null = null;
  if (args.include_recalls !== false && decoded.make && decoded.model && decoded.model_year) {
    try {
      const rec = await fetchRecallsRaw(fetchText, decoded.make, decoded.model, decoded.model_year);
      recallsSummary = {
        count: rec.length,
        park_it_count: rec.filter((x) => x.park_it).length,
        park_outside_count: rec.filter((x) => x.park_outside).length,
        campaigns: rec.slice(0, 10).map((x) => x.campaign_number),
      };
    } catch {
      recallsSummary = null;
    }
  }

  const label = [decoded.model_year, decoded.make, decoded.model, decoded.trim].filter(Boolean).join(' ') || decoded.vin;
  const specs = [
    decoded.body_class,
    decoded.engine_displacement_l ? `${decoded.engine_displacement_l}L` : null,
    decoded.engine_cylinders ? `${decoded.engine_cylinders}-cyl` : null,
    decoded.fuel_type,
    decoded.drive_type,
  ].filter(Boolean).join(', ');
  const recallNote = recallsSummary
    ? ` Found ${recallsSummary.count} NHTSA recall(s) for ${decoded.model_year} ${decoded.make} ${decoded.model}` +
      (recallsSummary.park_it_count > 0 ? ` (WARNING: ${recallsSummary.park_it_count} Do-Not-Drive / Park-It)` : '') +
      (recallsSummary.park_outside_count > 0 ? ` (WARNING: ${recallsSummary.park_outside_count} Park-Outside)` : '') + '.'
    : '';

  const summary = `VIN ${decoded.vin}: ${label}${specs ? ` (${specs})` : ''}.${recallNote}`;

  return {
    summary,
    vehicle: decoded,
    recalls_overview: recallsSummary,
    as_of: new Date().toISOString(),
    source: 'NHTSA vPIC VIN Decoder API (vpic.nhtsa.dot.gov) & NHTSA Recalls API (api.nhtsa.gov)',
    more: MORE_URL,
  };
}

async function fetchRecallsRaw(fetchText: FetchText, make: string, model: string, modelYear: number) {
  const qs = new URLSearchParams({ make, model, modelYear: String(modelYear) }).toString();
  const url = `${NHTSA_API}/recalls/recallsByVehicle?${qs}`;
  const data = await fetchJson<{ Count?: number; results?: Array<Record<string, unknown>> }>(fetchText, url, 1800);
  return (data.results ?? []).map((r) => ({
    campaign_number: String(r.NHTSACampaignNumber ?? ''),
    manufacturer: clean(r.Manufacturer),
    report_received_date: clean(r.ReportReceivedDate),
    component: clean(r.Component),
    summary: clean(r.Summary),
    consequence: clean(r.Consequence),
    remedy: clean(r.Remedy),
    notes: clean(r.Notes),
    park_it: Boolean(r.parkIt),
    park_outside: Boolean(r.parkOutSide),
    over_the_air_update: Boolean(r.overTheAirUpdate),
  }));
}

export interface VehicleRecallsArgs {
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  limit?: number;
}

export async function nhtsaVehicleRecalls(fetchText: FetchText, args: VehicleRecallsArgs) {
  const v = await resolveVehicle(fetchText, args);
  const all = await fetchRecallsRaw(fetchText, v.make, v.model, v.model_year);
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const items = all.slice(0, limit);

  const parkIt = all.filter((r) => r.park_it).length;
  const parkOutside = all.filter((r) => r.park_outside).length;
  const ota = all.filter((r) => r.over_the_air_update).length;

  const lines = items.slice(0, 6).map(
    (r) =>
      `- [${r.campaign_number}] (${r.report_received_date ?? 'n/a'}) ${r.component ?? 'Unknown component'}` +
      `${r.park_it ? ' [PARK IT / DO NOT DRIVE]' : ''}${r.park_outside ? ' [PARK OUTSIDE]' : ''}${r.over_the_air_update ? ' [OTA UPDATE]' : ''}`
  );
  const summary =
    all.length === 0
      ? `No NHTSA safety recalls found for ${v.model_year} ${v.make} ${v.model}${v.vin ? ` (VIN ${v.vin})` : ''}.`
      : `${v.model_year} ${v.make} ${v.model}${v.vin ? ` (VIN ${v.vin})` : ''} has ${all.length} NHTSA recall(s)` +
        ` (Park-It: ${parkIt}, Park-Outside: ${parkOutside}, OTA: ${ota}):\n${lines.join('\n')}`;

  return {
    summary,
    vehicle: v,
    total_recalls: all.length,
    park_it_count: parkIt,
    park_outside_count: parkOutside,
    over_the_air_update_count: ota,
    recalls: items,
    as_of: new Date().toISOString(),
    source: 'NHTSA Recalls API (api.nhtsa.gov/recalls/recallsByVehicle)',
    more: MORE_URL,
  };
}

export interface SafetyComplaintsArgs {
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  component?: string;
  limit?: number;
}

export async function nhtsaSafetyComplaints(fetchText: FetchText, args: SafetyComplaintsArgs) {
  const v = await resolveVehicle(fetchText, args);
  const qs = new URLSearchParams({ make: v.make, model: v.model, modelYear: String(v.model_year) }).toString();
  const url = `${NHTSA_API}/complaints/complaintsByVehicle?${qs}`;
  const data = await fetchJson<{ count?: number; results?: Array<Record<string, unknown>> }>(fetchText, url, 1800);
  const raw = data.results ?? [];

  const compFilter = args.component?.trim().toLowerCase();
  const filtered = compFilter
    ? raw.filter((c) => String(c.components ?? '').toLowerCase().includes(compFilter))
    : raw;

  let crashes = 0;
  let fires = 0;
  let injuries = 0;
  let deaths = 0;
  const compCounts = new Map<string, number>();

  for (const c of filtered) {
    if (c.crash) crashes++;
    if (c.fire) fires++;
    injuries += num(c.numberOfInjuries) ?? 0;
    deaths += num(c.numberOfDeaths) ?? 0;
    const comp = String(c.components ?? 'UNKNOWN').trim() || 'UNKNOWN';
    compCounts.set(comp, (compCounts.get(comp) ?? 0) + 1);
  }

  const topComponents = [...compCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([component, count]) => ({ component, count }));

  const limit = Math.min(Math.max(args.limit ?? 10, 1), 30);
  const recent = filtered.slice(0, limit).map((c) => ({
    odi_number: c.odiNumber ?? null,
    date_filed: clean(c.dateComplaintFiled),
    date_of_incident: clean(c.dateOfIncident),
    components: clean(c.components),
    crash: Boolean(c.crash),
    fire: Boolean(c.fire),
    injuries: num(c.numberOfInjuries) ?? 0,
    deaths: num(c.numberOfDeaths) ?? 0,
    summary: clean(c.summary)?.slice(0, 500) ?? null,
  }));

  const topStr = topComponents.slice(0, 4).map((t) => `${t.component} (${t.count})`).join(', ');
  const summary =
    filtered.length === 0
      ? `No NHTSA consumer complaints found for ${v.model_year} ${v.make} ${v.model}${compFilter ? ` matching component "${args.component}"` : ''}.`
      : `${v.model_year} ${v.make} ${v.model} has ${filtered.length} NHTSA complaint(s)${compFilter ? ` matching "${args.component}"` : ''} ` +
        `(crashes: ${crashes}, fires: ${fires}, injuries: ${injuries}, deaths: ${deaths}). Top components: ${topStr || 'n/a'}.`;

  return {
    summary,
    vehicle: v,
    total_complaints: filtered.length,
    crashes,
    fires,
    injuries,
    deaths,
    top_components: topComponents,
    recent_complaints: recent,
    as_of: new Date().toISOString(),
    source: 'NHTSA Complaints API (api.nhtsa.gov/complaints/complaintsByVehicle)',
    more: MORE_URL,
  };
}

export interface SafetyRatingsArgs {
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
}

export async function nhtsaSafetyRatings(fetchText: FetchText, args: SafetyRatingsArgs) {
  const v = await resolveVehicle(fetchText, args);
  const listUrl = `${NHTSA_API}/SafetyRatings/modelyear/${encodeURIComponent(String(v.model_year))}/make/${encodeURIComponent(v.make)}/model/${encodeURIComponent(v.model)}`;
  const list = await fetchJson<{ Count?: number; Results?: Array<{ VehicleId?: number; VehicleDescription?: string }> }>(
    fetchText,
    listUrl,
    86400
  );
  const variants = (list.Results ?? []).slice(0, 6);
  if (variants.length === 0) {
    return {
      summary: `No NHTSA 5-Star NCAP crash-test ratings published for ${v.model_year} ${v.make} ${v.model}.`,
      vehicle: v,
      variants: [],
      as_of: new Date().toISOString(),
      source: 'NHTSA 5-Star Safety Ratings API (api.nhtsa.gov/SafetyRatings)',
      more: MORE_URL,
    };
  }

  const detailed = await Promise.all(
    variants.map(async (vr) => {
      const id = vr.VehicleId;
      if (!id) return null;
      const d = await fetchJson<{ Results?: Array<Record<string, unknown>> }>(
        fetchText,
        `${NHTSA_API}/SafetyRatings/VehicleId/${id}`,
        86400
      );
      const r = d.Results?.[0];
      if (!r) return null;
      return {
        vehicle_id: id,
        description: clean(r.VehicleDescription) ?? vr.VehicleDescription ?? '',
        overall_rating: clean(r.OverallRating),
        front_crash_rating: clean(r.OverallFrontCrashRating),
        front_crash_driver: clean(r.FrontCrashDriversideRating),
        front_crash_passenger: clean(r.FrontCrashPassengersideRating),
        side_crash_rating: clean(r.OverallSideCrashRating),
        side_crash_driver: clean(r.SideCrashDriversideRating),
        side_crash_passenger: clean(r.SideCrashPassengersideRating),
        side_pole_crash_rating: clean(r.SidePoleCrashRating),
        rollover_rating: clean(r.RolloverRating),
        rollover_risk_pct: typeof r.RolloverPossibility === 'number' ? Math.round(r.RolloverPossibility * 1000) / 10 : null,
        electronic_stability_control: clean(r.NHTSAElectronicStabilityControl),
        forward_collision_warning: clean(r.NHTSAForwardCollisionWarning),
        lane_departure_warning: clean(r.NHTSALaneDepartureWarning),
        recalls_count: num(r.RecallsCount),
        complaints_count: num(r.ComplaintsCount),
        investigations_count: num(r.InvestigationCount),
      };
    })
  );

  const items = detailed.filter((x): x is NonNullable<typeof x> => x !== null);
  const lines = items.map(
    (x) =>
      `- ${x.description}: Overall ${x.overall_rating ?? 'Not Rated'}/5, Front ${x.front_crash_rating ?? 'n/a'}/5, Side ${x.side_crash_rating ?? 'n/a'}/5, Rollover ${x.rollover_rating ?? 'n/a'}/5${x.rollover_risk_pct !== null ? ` (${x.rollover_risk_pct}% risk)` : ''}`
  );
  const summary = `NHTSA 5-Star Safety Ratings for ${v.model_year} ${v.make} ${v.model} (${items.length} variant(s)):\n${lines.join('\n')}`;

  return {
    summary,
    vehicle: v,
    variants: items,
    as_of: new Date().toISOString(),
    source: 'NHTSA 5-Star Safety Ratings API (api.nhtsa.gov/SafetyRatings)',
    more: MORE_URL,
  };
}
