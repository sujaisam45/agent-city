# Rouen areas for a €600 studio budget (NEOMA student)

**Finding:** On official data, a 25 m² flat in the four communes with figures would cost about €372–392/month in rent alone, so all fit under €600 with room to spare; official data does not separate Rouen Centre or Rive Gauche, so those two areas could not be compared.

## Method
- Metric explained: "rent per m²" is the rent divided by the flat's surface. Monthly rent for a 25 m² studio = rent per m² × 25.
- Official source: the government "Carte des loyers" gives a model-estimated *predicted advertised rent* per m² per month for **apartments of 1 or 2 rooms**, by commune. It is the closest official proxy for a studio. It is not a measured average of signed leases, and it does not separate furnished from unfurnished.
- Computed in code: monthly rent for a 25 m² flat, and the change from 2024 to 2025.
- Second opinion: a reviewer checked the arithmetic and the claims; its points are reflected below.

## Figures (rent per m², €/m²/month)

| Area | 2025 | 2024 | Change 2024→2025 | 25 m² studio (rent only, 2025) |
|---|---|---|---|---|
| Rouen (commune, Centre not separable) | 15.38 | 15.00 | +0.38 (+2.5%) | €384.50 |
| Rouen Centre | no official figure | – | – | – |
| Rouen Rive Gauche | no official figure | – | – | – |
| Mont-Saint-Aignan | 15.68 | 14.94 | +0.74 (+5.0%) | €392.00 |
| Bois-Guillaume | 15.18 | 15.03 | +0.15 (+1.0%) | €379.50 |
| Déville-lès-Rouen | 14.90 | 14.36 | +0.54 (+3.8%) | €372.50 |

Size of the spread: the four communes sit within €1.00/m² of each other (about €25/month for a 25 m² flat). That gap is small, so "cheapest" should not be read as a decisive difference.

Chart: see `rent_per_m2_chart.png` (2025 values; Centre and Rive Gauche left out because there is no figure).

## Secondary figures (not official, not comparable, not in the table above)
- Manda (Yanport model, all property types, relevé 24 Sept 2026): Rouen citywide studio €20.73/m² from 159 listings → about €518/month for 25 m². This conflicts with the official 1–2 room figure (~€15/m²) by about 35%, is based on a small sample, and is citywide, not Centre-specific. Treat it with caution.
- Manda, Centre Ville–Rive Gauche quartier, all types: €13.62/m². Different property mix and geography; not comparable with the official figures.
- We did not use these secondary figures in the ranking.

## Sources
- Carte des loyers, indicateurs de loyers d'annonce par commune, 2025: https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025
- Carte des loyers, 2024: https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2024
- Ministry overview of the rent map: https://www.ecologie.gouv.fr/politiques-publiques/carte-loyers
- Manda Rouen estimate page (secondary): https://www.manda.fr/estimation-loyer/rouen-76000

## Caveats
- **Rent only.** The €600 budget must also cover service charges, utilities, insurance and any fees; these are not in the figures. Check the total monthly cost of each listing.
- **Model estimates, not signed leases.** Predicted values carry confidence intervals (not shown here). Differences of a few percent between communes or years may be within that margin.
- **1–2 room proxy.** Official data has no studio-only series, so a studio's rent may differ from this average.
- **Missing areas.** Rouen Centre and Rouen Rive Gauche have no official sub-communal figure in the datasets checked. An agglomeration observatory dataset (Observatoires locaux des loyers, Rouen) was identified but not checked; it may hold finer data.
- **Forecast:** none. No projections are made.
