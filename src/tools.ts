// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  BUNDLE_URL,
  InputError,
  nhtsaDecodeVin,
  nhtsaSafetyComplaints,
  nhtsaSafetyRatings,
  nhtsaVehicleRecalls,
  REPO,
  SERVICES_URL,
  SITE,
} from './core.js';
import type { FetchText } from './types.js';

export const VERSION = '1.0.0';

export const META = {
  alias: 'nhtsa-vehicle-recalls',
  metaDescription:
    'MCP server for NHTSA vehicle recalls, 17-character VIN decoding (vPIC), consumer safety complaints, and 5-Star NCAP crash-test ratings from api.nhtsa.gov.',
  intro:
    'Live NHTSA VIN decoder, open safety recalls (with Park-It / Park-Outside flags), consumer safety complaints, and 5-Star NCAP crash ratings for AI assistants, read directly from official US DOT NHTSA APIs.',
};

export const TOOL_INFO = [
  {
    name: 'nhtsa_decode_vin',
    blurb: 'Decode a 17-character VIN via NHTSA vPIC (make, model, year, trim, engine, plant, safety tech) plus open recall count.',
  },
  {
    name: 'nhtsa_vehicle_recalls',
    blurb: 'Check official NHTSA safety recalls by VIN or make/model/year, including Park-It, Park-Outside, and OTA flags.',
  },
  {
    name: 'nhtsa_safety_complaints',
    blurb: 'Aggregate NHTSA consumer safety complaints (crashes, fires, injuries, deaths, top components) by VIN or make/model/year.',
  },
  {
    name: 'nhtsa_safety_ratings',
    blurb: 'Fetch NHTSA 5-Star NCAP crash-test ratings (overall, front, side, rollover risk %, ADAS tech) by VIN or make/model/year.',
  },
];

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

function ok(data: Record<string, unknown> & { summary: string }) {
  return {
    content: [{ type: 'text' as const, text: `${data.summary}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: data,
  };
}

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `${e instanceof InputError ? 'Error' : 'Upstream NHTSA API error'}: ${msg}` }],
  };
}

const wrap = <A>(fn: (a: A) => unknown) => async (a: A) => {
  try {
    return ok((await fn(a)) as any);
  } catch (e) {
    return fail(e);
  }
};

const vehicleInputs = {
  vin: z.string().optional().describe('17-character US VIN (auto-decodes make, model, and year). Overrides make/model/model_year.'),
  make: z.string().optional().describe('Vehicle make (e.g. "Honda", "Ford", "Tesla"). Required if vin is omitted.'),
  model: z.string().optional().describe('Vehicle model (e.g. "Accord", "F-150", "Model Y"). Required if vin is omitted.'),
  model_year: z.number().int().min(1960).max(2030).optional().describe('4-digit model year (e.g. 2020). Required if vin is omitted.'),
};

export function createServer(fetchText: FetchText): McpServer {
  const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE } as any, {
    instructions:
      'Live US DOT NHTSA vehicle data (no API key required): VIN decoding via vPIC, open safety recalls, consumer safety complaints, and 5-Star NCAP crash-test ratings. ' +
      'Use nhtsa_decode_vin for any 17-character VIN, nhtsa_vehicle_recalls to check recalls and Park-It / Park-Outside warnings, nhtsa_safety_complaints for defect patterns and crash/fire counts, and nhtsa_safety_ratings for 5-Star crash ratings. ' +
      `For commercial pro MCP tools ($39 lifetime Zovo Pro MCP Bundle), see ${BUNDLE_URL}. For custom MCP server audits or builds, see ${SERVICES_URL}.`,
  });

  server.registerTool(
    'nhtsa_decode_vin',
    {
      title: 'Decode a 17-character VIN',
      description:
        'Decode a 17-character Vehicle Identification Number (VIN) using NHTSA vPIC: make, model, model year, trim, body class, engine, fuel type, drive type, manufacturing plant, standard safety equipment, and an overview of matching NHTSA recalls.',
      inputSchema: {
        vin: z.string().describe('17-character VIN (e.g. "1HGCM82633A004352").'),
        model_year: z.number().int().min(1960).max(2030).optional().describe('Optional model year hint for older VINs.'),
        include_recalls: z.boolean().optional().describe('Include an overview count of NHTSA recalls for the decoded vehicle. Default true.'),
      },
      annotations: { title: 'Decode a 17-character VIN', ...RO },
    },
    wrap((a: any) => nhtsaDecodeVin(fetchText, a))
  );

  server.registerTool(
    'nhtsa_vehicle_recalls',
    {
      title: 'Check NHTSA vehicle recalls',
      description:
        'Fetch official NHTSA safety recalls for a vehicle by 17-character VIN or make, model, and model_year. Returns recall count, urgent Park-It (Do Not Drive), Park-Outside, and Over-The-Air update flags, campaign numbers, components, summaries, consequences, and remedies.',
      inputSchema: {
        ...vehicleInputs,
        limit: z.number().int().min(1).max(100).optional().describe('Maximum recall campaigns returned (1 to 100). Default 20.'),
      },
      annotations: { title: 'Check NHTSA vehicle recalls', ...RO },
    },
    wrap((a: any) => nhtsaVehicleRecalls(fetchText, a))
  );

  server.registerTool(
    'nhtsa_safety_complaints',
    {
      title: 'NHTSA consumer safety complaints',
      description:
        'Fetch and aggregate official NHTSA consumer safety complaints for a vehicle by VIN or make, model, and model_year. Returns total complaints, crash/fire/injury/death counts, top complained-about components, and recent complaint summaries (optionally filtered by component keyword).',
      inputSchema: {
        ...vehicleInputs,
        component: z.string().optional().describe('Optional component keyword filter (e.g. "ELECTRICAL", "BRAKES", "AIR BAGS").'),
        limit: z.number().int().min(1).max(30).optional().describe('Maximum recent complaint entries returned (1 to 30). Default 10.'),
      },
      annotations: { title: 'NHTSA consumer safety complaints', ...RO },
    },
    wrap((a: any) => nhtsaSafetyComplaints(fetchText, a))
  );

  server.registerTool(
    'nhtsa_safety_ratings',
    {
      title: 'NHTSA 5-Star crash safety ratings',
      description:
        'Fetch official NHTSA 5-Star NCAP crash-test safety ratings by VIN or make, model, and model_year: overall stars, front crash, side crash, side pole, rollover stars and rollover risk %, standard crash-avoidance tech (ESC, FCW, LDW), and recall/complaint/investigation counts per trim variant.',
      inputSchema: {
        ...vehicleInputs,
      },
      annotations: { title: 'NHTSA 5-Star crash safety ratings', ...RO },
    },
    wrap((a: any) => nhtsaSafetyRatings(fetchText, a))
  );

  return server;
}
