# Electricity Reference

## Plain-Language Aliases

| You say...                        | Endpoint                                      | Key params                          |
|-----------------------------------|-----------------------------------------------|-------------------------------------|
| electricity prices                | /v2/electricity/retail-sales                  | data[]=price                        |
| electricity prices by state       | /v2/electricity/retail-sales                  | data[]=price, facets[]=stateid[]    |
| power generation                  | /v2/electricity/electric-power-operational    | data[]=generation                   |
| generation by fuel type           | /v2/electricity/electric-power-operational    | data[]=generation, facets[]=fueltypeid[] |
| grid capacity                     | /v2/electricity/capacity                      | data[]=nameplate-capacity-mw        |
| utility sales / consumption       | /v2/electricity/retail-sales                  | data[]=sales                        |
| renewable energy share            | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=SUN,WND,WAT,GEO |
| solar generation                  | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=SUN           |
| wind generation                   | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=WND           |
| nuclear generation                | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=NUC           |
| coal generation                   | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=COL           |
| natural gas power                 | /v2/electricity/electric-power-operational    | facets[]=fueltypeid[]=NG            |
| electricity emissions             | /v2/electricity/electric-power-operational    | data[]=total-consumption-btu        |
| planned outages / reliability     | /v2/electricity/rto/daily-region-data         | data[]=value                        |
| hourly demand                     | /v2/electricity/rto/region-data               | data[]=value, frequency=hourly      |
| state electricity mix             | /v2/electricity/electric-power-operational    | facets[]=stateid[], facets[]=fueltypeid[] |

---

## Frequency Options
- `hourly` — last 7 days max recommended
- `monthly` — default for most trend charts
- `annual` — for long-term comparisons

## Common State Codes
TX, CA, FL, NY, PA, IL, OH, GA, NC, MI, NJ, VA, WA, AZ, MA, TN, IN, MD, MN, MO

## Fuel Type Codes
| Code | Fuel         |
|------|--------------|
| SUN  | Solar        |
| WND  | Wind         |
| WAT  | Hydro        |
| NUC  | Nuclear      |
| NG   | Natural Gas  |
| COL  | Coal         |
| GEO  | Geothermal   |
| OTH  | Other        |

## Notes
- Retail prices are in cents/kWh
- Generation is in thousand MWh
- State-level data availability varies by frequency
- RTO/ISO data (hourly demand) requires region codes: MISO, PJM, CAISO, ERCOT, SPP, NYISO, ISONE
