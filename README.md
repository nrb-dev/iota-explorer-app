# IOTA Validator Globe

Eksplorator walidatorów IOTA inspirowany [gmonads.com](https://www.gmonads.com/).
Strona główna to interaktywny globus 3D z grupami walidatorów rozmieszczonymi
geograficznie, plus dashboard z metrykami sieci i ostatnimi transakcjami.
Pełna lista walidatorów, podstrony szczegółów, wykresy i kalkulator stakingu
żyją pod osobnymi route'ami (`/validators`, `/charts`, `/staking`).

## Stack

- **Next.js 16 + React 19** (App Router, RSC tam gdzie ma sens, klient tam gdzie potrzeba interakcji)
- **Tailwind CSS 4** + **shadcn/ui** (Base UI) — system designu i komponenty
- **react-globe.gl** (Three.js) — globus 3D
- **SWR** — polling i cache po stronie klienta
- **Zustand** — stan UI (wybór sieci, preferencje wizualne)
- **Recharts** — wykresy
- **Bun** — runner i package manager

## Decyzje architektoniczne

### 1. „Live data" = polling, nie WebSocket

Komitet walidatorów IOTA jest zafiksowany na epokę (~24h). W trakcie epoki
realnie zmieniają się APY, gas price, accumulated rewards i metadane.
Subskrypcje WS w IOTA RPC są oznaczone jako deprecated, więc używam SWR z
różnymi interwałami w zależności od dynamiki danych:

| Dane                             | Interwał | Powód                                               |
| -------------------------------- | -------- | --------------------------------------------------- |
| Lista walidatorów + geo          | 5 min    | Set walidatorów stabilny w epoce                    |
| Metryki sieci (TPS, gas, supply) | 30 s     | Zmieniają się ciągle                                |
| Recent transactions              | 6 s      | Tylko gdy sekcja widoczna (Page Visibility / pause) |
| Ostatnie epoki                   | 5 min    | Zmiana raz na ~24h                                  |
| RPC status                       | 15 s     | Health-check                                        |

Polling pauzuje się, kiedy zakładka jest niewidoczna albo sekcja transakcji
jest schowana — żeby nie palić quoty RPC.

### 2. Bezpieczeństwo RPC = server-side proxy + rate limit + cache

Klient nigdy nie woła publicznego RPC bezpośrednio. Wszystkie zapytania
przechodzą przez własne route handlery (`/api/validators`, `/api/network`,
`/api/transactions`, `/api/epoch(s)`, `/api/rpc-status`):

1. **URL i klucz RPC są server-only** — `import 'server-only'` w
   [lib/iota/rpc-client.ts](lib/iota/rpc-client.ts), env-vars bez prefiksu
   `NEXT_PUBLIC_`. Bundle klienta nie zawiera adresu upstreamu.
2. **Rate limit per-IP** (token bucket, 60 req/min, burst 10) zaimplementowany
   in-memory w [lib/rate-limit.ts](lib/rate-limit.ts). Klucz biorę z zaufanych
   nagłówków platformy (`cf-connecting-ip`, `x-vercel-forwarded-for`, …);
   `x-forwarded-for` jest opt-in, żeby nie spoofować klucza w lokalnym devie.
   Na produkcji to soft limit per-instancja — pod docelowy ruch wymieniłbym na
   Upstash/Vercel KV.
3. **Cache-Control** na każdym route (np. `s-maxage=60, stale-while-revalidate=300`)
   żeby CDN absorbował duplikaty.
4. **In-process cache + dedupe inflight requestów** w
   [lib/iota/validators.ts](lib/iota/validators.ts) — równoległe wywołania
   dzielą jeden roundtrip do RPC.
5. **Timeout 10 s + AbortController** na każdym wywołaniu RPC.

### 3. Mainnet (default) + przełącznik na testnet

Domyślnie publiczny endpoint `api.mainnet.iota.cafe`. Wartości można nadpisać
zmiennymi środowiskowymi (poniżej). Sieć przełączana w UI jest trzymana w URL
(`?network=...`) i w zustand store, żeby było shareable.

### 4. Zakres interakcji = (a) + (b), bez wallet connect

- klik na walidatora w tabeli → `/validators/[address]` z pełnymi danymi i mini-mapą,
- sortowalna tabela (voting power, stake, APY, commission), paginacja, badge dla niezgeolocalizowanych,
- na globusie dwa poziomy LOD: kontynenty z daleka, kraje po przybliżeniu (zoom band hysteresis, żeby nie migotało),
- „komety" między walidatorami na globe można wyłączyć w nagłówku (mobile = mniej, dla wydajności),
- `/staking` to czysty kalkulator APY na bazie publicznych danych pool — **bez wallet connect** (to znacząco większy zakres, nie był wymagany).

### 5. Geolokalizacja — DNS + ip-api batch + 24h cache

IOTA RPC zwraca `netAddress` typu `/dns/host/tcp/...` lub `/ip4/.../tcp/...`,
nie współrzędne. Pipeline w [lib/iota/geo.ts](lib/iota/geo.ts):

1. Parsowanie hosta z multiaddr ([lib/iota/net-address.ts](lib/iota/net-address.ts))
2. `dns.resolve4()` → IP
3. Batch POST do `ip-api.com` (do 100 IP / request)
4. In-memory cache na 24h, kluczowane hostem

Walidatory bez geo lecą do tabeli z badge „Unknown location" — nie pomijam ich,
bo to wciąż walidne członki komitetu. Free tier `ip-api.com` jest tylko
HTTP, więc plain-text request jest opt-in (`IP_API_ALLOW_INSECURE_HTTP=true`)
i jest świadomym kompromisem dev/recruitment — pod prod zamieniłbym na płatny
ip-api pro / ipinfo / własną tablicę GeoIP.

### 6. Mobile + fallback bez WebGL

`react-globe.gl` jest ładowany przez `next/dynamic` z `ssr: false`. Po
zamontowaniu sprawdzam dostępność WebGL — jeśli kontekstu nie da się pobrać,
zamiast Three.js renderuję statyczny obraz globusa z komunikatem (dane
walidatorów dalej działają w tabeli niżej). Liczba neonowych komet jest
zmniejszona dla viewportów < 640px.

### 7. Brak scrapingu Explorera

Specyfikacja mówiła o danych z `explorer.iota.org/validators`, ale ta strona
to też tylko klient renderujący dane z tego samego JSON-RPC. Zamiast scrapingu
HTML czytam więc bezpośrednio RPC (`iotax_getLatestIotaSystemStateV2`,
`iotax_getValidatorsApy`, `iotax_queryTransactionBlocks`, …) — stabilniej,
szybciej, łatwiej do cache'a.

## Getting Started

```bash
bun install
bun dev
```

Aplikacja na [http://localhost:3000](http://localhost:3000).

```bash
bun run lint    # ESLint
bun run test    # node --test (tests/*.test.mts)
bun run build   # production build
```

## Zmienne środowiskowe

```bash
# RPC — wszystkie server-only, brak NEXT_PUBLIC_
IOTA_RPC_URL=https://api.mainnet.iota.cafe          # alias dla mainnet
IOTA_MAINNET_RPC_URL=...                            # opcjonalnie nadpisuje powyższe
IOTA_TESTNET_RPC_URL=https://api.testnet.iota.cafe
IOTA_RPC_KEY=...                                    # wspólny klucz, jeśli provider go wymaga
IOTA_MAINNET_RPC_KEY=...
IOTA_TESTNET_RPC_KEY=...

# Geo enrichment (opcjonalne — bez tego walidatory dostaną „Unknown location")
IP_API_URL=http://ip-api.com/batch?fields=status,message,query,lat,lon,continent,country,city
IP_API_ALLOW_INSECURE_HTTP=true   # świadoma zgoda na HTTP do free tier ip-api

# Rate limit
TRUST_X_FORWARDED_FOR=true        # tylko jeśli zaufany proxy
```

## Struktura

```
app/
  api/                  # route handlery, server-only proxy do IOTA RPC
  validators/           # /validators, /validators/[address]
  transactions/[digest] # detal transakcji
  charts/, staking/
components/
  globe/                # Three.js + grouping, LOD, label rendering
  validators/, home/, staking/, charts/, ui/
lib/
  iota/                 # RPC client, geo, types, network/validator/tx queries
  rate-limit.ts, api-utils.ts, network-store.ts, …
tests/                  # jednostkowe (node --test): formattery, parser multiaddr, RPC config
```
