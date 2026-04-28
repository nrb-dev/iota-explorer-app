This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## IOTA geo enrichment

Validator geolocation is optional and runs server-side from validator network
addresses. The public `ip-api.com` free batch endpoint does not support HTTPS,
so use it only when you explicitly accept plaintext requests for public
validator infrastructure IPs:

```bash
IP_API_URL=http://ip-api.com/batch?fields=status,message,query,lat,lon,continent,country,city
IP_API_ALLOW_INSECURE_HTTP=true
```

For production, prefer an HTTPS provider or the paid ip-api pro endpoint.
