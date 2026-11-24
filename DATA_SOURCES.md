# Data Sources

All data is fetched live at call time from official US Department of Transportation National Highway Traffic Safety Administration (NHTSA) public APIs. No API key is required.

- **NHTSA vPIC VIN Decoder:** `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json` — vehicle specifications, engine/powertrain, manufacturing plant, and standard safety features.
- **NHTSA Recalls API:** `https://api.nhtsa.gov/recalls/recallsByVehicle` — recall campaigns, Park-It / Park-Outside / OTA flags, summaries, consequences, and remedies.
- **NHTSA Complaints API:** `https://api.nhtsa.gov/complaints/complaintsByVehicle` — consumer ODI safety complaints, crash/fire/injury/death reports, and affected components.
- **NHTSA 5-Star Safety Ratings (NCAP):** `https://api.nhtsa.gov/SafetyRatings/` — overall, front, side, side pole, and rollover star ratings, rollover risk probability, and crash-avoidance technology.
