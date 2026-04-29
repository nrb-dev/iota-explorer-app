# IOTA validator globe

This app is a small IOTA-focused version of a validator explorer inspired by
gmonads. The main view shows a 3D globe with validator locations, plus live
network and validator data in the dashboard below it.

The validator list on `explorer.iota.org/validators` is rendered by the IOTA
Explorer frontend. Instead of scraping that page, this project reads the same
kind of network data from IOTA JSON-RPC on the server. That keeps the browser
away from the RPC URL/key, makes the data easier to cache, and is simpler to
explain and maintain.

The client only calls local API routes like `/api/validators`. Those routes
then call IOTA RPC from the server, add cache headers, and apply a small
per-client rate limit.

Live updates are handled with SWR polling:

- validators refresh every 5 minutes, because the active validator set changes
  slowly around epochs
- network metrics refresh every 30 seconds
- recent transactions refresh every few seconds when that section is visible

## Getting Started

Install dependencies and run the development server with Bun:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Useful checks before submitting changes:

```bash
bun run lint
bun run test
bun run build
```

## Environment variables

RPC values are intentionally server-only.

```bash
IOTA_RPC_URL=https://your-mainnet-rpc.example
IOTA_TESTNET_RPC_URL=https://your-testnet-rpc.example
IOTA_RPC_KEY=optional-secret-key
```

## IOTA geo enrichment

Validator geolocation is optional and runs server-side from validator network
addresses. The public `ip-api.com` free batch endpoint does not support HTTPS,
so this project uses HTTP only when plaintext requests are explicitly enabled
for public validator infrastructure IPs:

```bash
IP_API_URL=http://ip-api.com/batch?fields=status,message,query,lat,lon,continent,country,city
IP_API_ALLOW_INSECURE_HTTP=true
```

For production, prefer an HTTPS provider or the paid ip-api pro endpoint.
