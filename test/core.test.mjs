import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InputError,
  nhtsaDecodeVin,
  nhtsaSafetyComplaints,
  nhtsaSafetyRatings,
  nhtsaVehicleRecalls,
  normalizeVin,
} from '../dist/core.js';

const MOCK_VPIC = {
  Results: [
    {
      Make: 'HONDA',
      Model: 'Accord',
      ModelYear: '2020',
      Trim: 'EX',
      BodyClass: 'Sedan/Saloon',
      VehicleType: 'PASSENGER CAR',
      Doors: '4',
      DriveType: 'FWD/Front-Wheel Drive',
      EngineCylinders: '4',
      DisplacementL: '1.5',
      FuelTypePrimary: 'Gasoline',
      Manufacturer: 'AMERICAN HONDA MOTOR CO., INC.',
      PlantCity: 'MARYSVILLE',
      PlantState: 'OHIO',
      PlantCountry: 'UNITED STATES (USA)',
      ABS: 'Standard',
      ESC: 'Standard',
      ErrorCode: '0',
    },
  ],
};

const MOCK_RECALLS = {
  Count: 1,
  results: [
    {
      Manufacturer: 'Honda (American Honda Motor Co.)',
      NHTSACampaignNumber: '20V771000',
      parkIt: false,
      parkOutSide: true,
      overTheAirUpdate: false,
      ReportReceivedDate: '10/12/2020',
      Component: 'ELECTRICAL SYSTEM:BODY CONTROL MODULE:SOFTWARE',
      Summary: 'A software error may disrupt displays.',
      Consequence: 'Increased risk of crash.',
      Remedy: 'Dealers will update software free of charge.',
    },
  ],
};

const MOCK_COMPLAINTS = {
  count: 2,
  results: [
    {
      odiNumber: 11777479,
      crash: true,
      fire: false,
      numberOfInjuries: 1,
      numberOfDeaths: 0,
      dateOfIncident: '08/01/2026',
      dateComplaintFiled: '11/12/2026',
      components: 'ELECTRICAL SYSTEM',
      summary: 'Touchscreen ghost touches.',
    },
    {
      odiNumber: 11777480,
      crash: false,
      fire: false,
      numberOfInjuries: 0,
      numberOfDeaths: 0,
      dateOfIncident: '08/02/2026',
      dateComplaintFiled: '11/13/2026',
      components: 'BRAKES',
      summary: 'Brake warning light.',
    },
  ],
};

const MOCK_RATINGS_LIST = {
  Count: 1,
  Results: [{ VehicleDescription: '2020 Honda ACCORD 4 DR FWD', VehicleId: 14818 }],
};

const MOCK_RATING_DETAIL = {
  Count: 1,
  Results: [
    {
      VehicleId: 14818,
      VehicleDescription: '2020 Honda ACCORD 4 DR FWD',
      OverallRating: '5',
      OverallFrontCrashRating: '5',
      FrontCrashDriversideRating: '5',
      FrontCrashPassengersideRating: '5',
      OverallSideCrashRating: '5',
      SideCrashDriversideRating: '5',
      SideCrashPassengersideRating: '5',
      SidePoleCrashRating: '5',
      RolloverRating: '5',
      RolloverPossibility: 0.093,
      NHTSAElectronicStabilityControl: 'Standard',
      NHTSAForwardCollisionWarning: 'Standard',
      NHTSALaneDepartureWarning: 'Standard',
      RecallsCount: 5,
      ComplaintsCount: 373,
      InvestigationCount: 1,
    },
  ],
};

const fakeFetch = async (url) => {
  if (url.includes('DecodeVinValues')) return JSON.stringify(MOCK_VPIC);
  if (url.includes('recallsByVehicle')) return JSON.stringify(MOCK_RECALLS);
  if (url.includes('complaintsByVehicle')) return JSON.stringify(MOCK_COMPLAINTS);
  if (url.includes('/SafetyRatings/VehicleId/')) return JSON.stringify(MOCK_RATING_DETAIL);
  if (url.includes('/SafetyRatings/modelyear/')) return JSON.stringify(MOCK_RATINGS_LIST);
  throw new Error(`unexpected url: ${url}`);
};

test('VIN validation rejects invalid length or forbidden characters', () => {
  assert.equal(normalizeVin('1hgcm82633a004352'), '1HGCM82633A004352');
  assert.throws(() => normalizeVin('SHORT'), InputError);
  assert.throws(() => normalizeVin('1HGCM82633A00435O'), InputError);
});

test('nhtsaDecodeVin decodes VIN and includes recall overview', async () => {
  const res = await nhtsaDecodeVin(fakeFetch, { vin: '1HGCM82633A004352' });
  assert.equal(res.vehicle.make, 'HONDA');
  assert.equal(res.vehicle.model, 'Accord');
  assert.equal(res.recalls_overview.count, 1);
  assert.equal(res.recalls_overview.park_outside_count, 1);
});

test('nhtsaVehicleRecalls works by make/model/year and flags park_outside', async () => {
  const res = await nhtsaVehicleRecalls(fakeFetch, { make: 'Honda', model: 'Accord', model_year: 2020 });
  assert.equal(res.total_recalls, 1);
  assert.equal(res.park_outside_count, 1);
  assert.equal(res.recalls[0].campaign_number, '20V771000');
});

test('nhtsaSafetyComplaints aggregates crashes, injuries, and component filter', async () => {
  const all = await nhtsaSafetyComplaints(fakeFetch, { make: 'Honda', model: 'Accord', model_year: 2020 });
  assert.equal(all.total_complaints, 2);
  assert.equal(all.crashes, 1);
  assert.equal(all.injuries, 1);

  const filtered = await nhtsaSafetyComplaints(fakeFetch, { make: 'Honda', model: 'Accord', model_year: 2020, component: 'electrical' });
  assert.equal(filtered.total_complaints, 1);
});

test('nhtsaSafetyRatings fetches variant crash scores and rollover risk %', async () => {
  const res = await nhtsaSafetyRatings(fakeFetch, { make: 'Honda', model: 'Accord', model_year: 2020 });
  assert.equal(res.variants.length, 1);
  assert.equal(res.variants[0].overall_rating, '5');
  assert.equal(res.variants[0].rollover_risk_pct, 9.3);
});
