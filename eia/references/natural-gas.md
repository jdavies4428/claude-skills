# Natural Gas Reference

## Plain-Language Aliases

| You say...                        | Endpoint                              | Key params                    |
|-----------------------------------|---------------------------------------|-------------------------------|
| natural gas prices                | /v2/natural-gas/pri/sum               | data[]=value                  |
| gas storage                       | /v2/natural-gas/stor/wkly             | data[]=value                  |
| gas storage vs 5yr average        | /v2/natural-gas/stor/wkly             | data[]=value (fetch 5y, calc) |
| gas production                    | /v2/natural-gas/prod/sum              | data[]=value                  |
| gas consumption                   | /v2/natural-gas/cons/sum              | data[]=value                  |
| gas imports                       | /v2/natural-gas/move/impc             | data[]=value                  |
| gas exports                       | /v2/natural-gas/move/expc             | data[]=value                  |
| LNG exports                       | /v2/natural-gas/move/lngc             | data[]=value                  |
| pipeline flows                    | /v2/natural-gas/move/poe1             | data[]=value                  |
| residential gas prices            | /v2/natural-gas/pri/res               | data[]=value                  |
| commercial gas prices             | /v2/natural-gas/pri/com               | data[]=value                  |
| industrial gas prices             | /v2/natural-gas/pri/ind               | data[]=value                  |
| Henry Hub price                   | /v2/natural-gas/pri/fut               | data[]=value                  |
| wellhead price                    | /v2/natural-gas/pri/sum               | data[]=value                  |

---

## Frequency Options
- `weekly` — storage data only
- `monthly` — default for prices and production
- `annual` — long-term trend analysis

## Units
- Prices: dollars per thousand cubic feet ($/Mcf) or $/MMBtu
- Storage: billion cubic feet (Bcf)
- Production/Consumption: million cubic feet (MMcf) or Bcf

## Notes
- Weekly storage is the most-watched gas data point (released every Thursday)
- Henry Hub is the national benchmark price
- Storage vs 5-year average is a key market signal — compute by fetching 5 years
  of weekly data and calculating the rolling average band
