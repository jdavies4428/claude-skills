# Petroleum Reference

## Plain-Language Aliases

| You say...                        | Endpoint                              | Key params          |
|-----------------------------------|---------------------------------------|---------------------|
| crude oil prices                  | /v2/petroleum/pri/spt                 | data[]=value        |
| WTI price                         | /v2/petroleum/pri/spt                 | facets[]=product[]=EPCWTI |
| Brent price                       | /v2/petroleum/pri/spt                 | facets[]=product[]=EPCOILBRENT |
| oil production                    | /v2/petroleum/crd/crpdn               | data[]=value        |
| oil inventory / stocks            | /v2/petroleum/stoc/wstk               | data[]=value        |
| gasoline prices                   | /v2/petroleum/pri/gnd                 | data[]=value        |
| regular gasoline                  | /v2/petroleum/pri/gnd                 | facets[]=grade[]=R  |
| diesel prices                     | /v2/petroleum/pri/wdf                 | data[]=value        |
| refinery utilization              | /v2/petroleum/pnp/wiup                | data[]=value        |
| crude imports                     | /v2/petroleum/move/imp                | data[]=value        |
| crude exports                     | /v2/petroleum/move/exp                | data[]=value        |
| strategic petroleum reserve       | /v2/petroleum/stoc/p1                 | data[]=value        |
| gas prices by state               | /v2/petroleum/pri/gnd                 | facets[]=area[]     |
| jet fuel prices                   | /v2/petroleum/pri/isp                 | data[]=value        |
| propane prices                    | /v2/petroleum/pri/prop                | data[]=value        |

---

## Frequency Options
- `weekly` — prices, stocks, refinery data
- `monthly` — production, imports/exports
- `annual` — long-term trend analysis

## Units
- Crude prices: dollars per barrel ($/bbl)
- Gasoline/diesel: dollars per gallon ($/gal)
- Production/stocks: thousand barrels (Mbbl) or million barrels (MMbbl)

## Key Product Codes
| Code        | Product            |
|-------------|--------------------|
| EPCWTI      | WTI Crude          |
| EPCOILBRENT | Brent Crude        |
| R           | Regular Gasoline   |
| M           | Midgrade Gasoline  |
| P           | Premium Gasoline   |

## Notes
- Gasoline prices by state use PADD region codes or state abbreviations
- Weekly stocks data is released every Wednesday (EIA Petroleum Status Report)
- WTI vs Brent spread is a common comparison — fetch both and overlay
