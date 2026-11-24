# nhtsa-vehicle-recalls-vin-mcp

Live US DOT NHTSA VIN decoder, vehicle safety recalls, consumer safety complaints, and 5-Star NCAP crash-test ratings for AI assistants. Reads directly from the official NHTSA vPIC and NHTSA Safety APIs (`vpic.nhtsa.dot.gov`, `api.nhtsa.gov`) at call time with no API key required.

Decode any 17-character VIN, check open recalls with urgent Park-It (Do Not Drive) and Park-Outside warnings, analyze consumer defect patterns and crash/fire counts, and inspect 5-Star NCAP crash-test scores.

## Tools

| Tool | What it returns |
| --- | --- |
| `nhtsa_decode_vin` | Decode a 17-character VIN via NHTSA vPIC: make, model, year, trim, body class, engine, fuel type, drive type, manufacturing plant, safety equipment, and an overview count of matching NHTSA recalls. |
| `nhtsa_vehicle_recalls` | Official NHTSA safety recalls by VIN or make/model/year, including Park-It, Park-Outside, and Over-The-Air update flags, campaign numbers, components, summaries, consequences, and remedies. |
| `nhtsa_safety_complaints` | Consumer safety complaints by VIN or make/model/year: total complaints, crashes, fires, injuries, deaths, top complained-about components, and recent complaint details (filterable by component keyword). |
| `nhtsa_safety_ratings` | Official NHTSA 5-Star NCAP crash-test ratings by VIN or make/model/year: overall, front, side, side pole, and rollover ratings, rollover risk %, standard ADAS crash-avoidance tech, and recall/complaint/investigation counts per trim variant. |

Every result includes structured JSON, a plain-text summary, `as_of`, `source`, and `more`. Every tool is marked read-only.

## Install

### Hosted (free, keyless Streamable HTTP)

Paste this URL into Claude, ChatGPT developer mode, or any remote MCP client. No token, no sign-up:

```
https://nhtsa-vehicle-recalls-vin-mcp.lipmichal.workers.dev/mcp
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nhtsa-vehicle-recalls": {
      "url": "https://nhtsa-vehicle-recalls-vin-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "nhtsa-vehicle-recalls": {
      "type": "http",
      "url": "https://nhtsa-vehicle-recalls-vin-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### Local stdio

```bash
git clone https://github.com/theluckystrike/nhtsa-vehicle-recalls-vin-mcp
cd nhtsa-vehicle-recalls-vin-mcp
npm install && npm run build
node dist/stdio.js
```

## Example prompts

- "Decode VIN 1HGCM82633A004352 and tell me if it has any NHTSA safety recalls."
- "Check all NHTSA recalls for a 2020 Honda Accord, especially any Park-It or Park-Outside warnings."
- "What are the most common NHTSA consumer safety complaints for a 2020 Honda Accord?"
- "Show the NHTSA 5-Star crash safety ratings and rollover risk for a 2020 Honda Accord."

## Upgrade & Commercial MCP Services

- **Zovo Pro MCP Bundle ($39 lifetime):** Unlock the full suite of commercial MCP servers with priority hosted endpoints at [mcp.zovo.one/bundle](https://mcp.zovo.one/bundle?src=sat.nhtsa-vehicle-recalls-vin-mcp).
- **Custom MCP Audit & Build Services:** Need a private, production-hardened MCP server for your automotive, insurance, or fleet platform? Book an audit or custom build at [mcpstamp.com/services](https://www.mcpstamp.com/services/?src=sat.nhtsa-vehicle-recalls-vin-mcp).
- **More Free Live-Data MCP Servers:** Browse the full directory at [mcpstamp.com/free-servers](https://www.mcpstamp.com/free-servers/?utm_source=mcp&utm_medium=nhtsa-vehicle-recalls-vin-mcp).

## Data sources

Full list in [DATA_SOURCES.md](DATA_SOURCES.md).

- NHTSA vPIC VIN Decoder API (`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/`)
- NHTSA Recalls API (`https://api.nhtsa.gov/recalls/recallsByVehicle`)
- NHTSA Complaints API (`https://api.nhtsa.gov/complaints/complaintsByVehicle`)
- NHTSA 5-Star Safety Ratings API (`https://api.nhtsa.gov/SafetyRatings/`)

## License

MIT
