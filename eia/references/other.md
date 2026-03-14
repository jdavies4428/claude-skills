# Other Energy Sources Reference

## Coal

| You say...                | Endpoint                              | Key params    |
|---------------------------|---------------------------------------|---------------|
| coal production           | /v2/coal/production/quarterly         | data[]=value  |
| coal consumption          | /v2/coal/consumption/quarterly        | data[]=value  |
| coal prices               | /v2/coal/shipments/receipts/quarterly | data[]=value  |
| coal stocks               | /v2/coal/stocks/quarterly             | data[]=value  |
| coal exports              | /v2/coal/exports                      | data[]=value  |

---

## Renewables (Non-Electric)

| You say...                | Endpoint                              | Key params    |
|---------------------------|---------------------------------------|---------------|
| ethanol production        | /v2/petroleum/pnp/epoor               | data[]=value  |
| biodiesel production      | /v2/petroleum/pnp/epobob              | data[]=value  |
| biomass energy            | /v2/seds/BMTCB                        | data[]=value  |
| geothermal energy         | /v2/seds/GETCB                        | data[]=value  |

---

## Total Energy / Cross-Sector

| You say...                | Endpoint                              | Key params    |
|---------------------------|---------------------------------------|---------------|
| total US energy production | /v2/total-energy/data                | data[]=value, facets[]=msn[]=PAPRPUS |
| total US energy consumption| /v2/total-energy/data                | data[]=value, facets[]=msn[]=TETCBUS |
| energy by state           | /v2/seds                              | data[]=value, facets[]=stateid[]     |
| CO2 emissions             | /v2/co2-emissions/co2-emissions-aggregates | data[]=value               |
| emissions by state        | /v2/co2-emissions/co2-emissions-aggregates | facets[]=stateId[]         |
| energy intensity          | /v2/seds                              | msn codes for intensity series       |

---

## Nuclear

| You say...                | Endpoint                                      | Key params    |
|---------------------------|-----------------------------------------------|---------------|
| nuclear generation        | /v2/electricity/electric-power-operational    | fueltypeid=NUC|
| nuclear capacity          | /v2/electricity/capacity                      | fueltypeid=NUC|
| reactor status            | /v2/nuclear-outages/us-nuclear-outages        | data[]=value  |

---

## Units
- Coal: short tons (st) or thousand short tons (Kst)
- Total energy: quadrillion Btu (quads) or trillion Btu
- Emissions: million metric tons CO2 (MMtCO2)
