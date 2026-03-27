# RAG Public Dashboard

Vercel-backed public RAG search and browse dashboard for academic papers.
This is the live UI source for `rag.orebit.id` after cutover; the legacy Streamlit showcase remains only as rollback reference.

## Deploy to Vercel

### Prerequisites

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Check the canonical secrets file first:
   ```bash
   test -f ~/.openclaw/secrets.env && grep '^VERCEL_TOKEN=' ~/.openclaw/secrets.env
   ```
   If the token is missing, then either add it to `~/.openclaw/secrets.env` or login once and sync it there.

### Deployment Steps

1. Navigate to project directory:
   ```bash
   cd /root/.openclaw/workspace/apps/rag-public
   ```

2. Deploy to Vercel:
   ```bash
   vercel
   ```

3. Follow prompts:
   - Set up and deploy to Vercel
   - Project name: `rag-public-dashboard`
   - Link to existing project if exists

4. Set environment variables:
   - `RAG_API_BASE`: Public base URL for the RAG API wrapper (for example, `https://api.orebit.id/api/rag`)
   - `RAG_API_KEY`: API key used by the Vercel serverless proxy to authenticate with the wrapper
   - Add via Vercel dashboard or CLI: `vercel env add RAG_API_BASE` / `vercel env add RAG_API_KEY`

5. Configure custom domain (if needed):
   - Add `rag.orebit.id` in Vercel dashboard
   - Update DNS: `rag` → `cname.vercel-dns.com`

### API Connection

The frontend calls the same-origin Vercel proxy at `/api/rag`. The proxy forwards to the public wrapper using server-side env values.

- **API Base URL (client)**: `/api/rag` in production, `http://127.0.0.1:3004/api/rag` in local development
- **Public wrapper host**: `api.orebit.id`
- **Proxy env (server-side only)**: `RAG_API_BASE`, `RAG_API_KEY`
- **Endpoints**:
  - `GET /api/rag/stats` - Collection statistics
  - `POST /api/rag/search` - Vector similarity search
  - `GET /api/rag/browse` - Browse papers (paginated)
  - `GET /api/rag/health` - Health check

### Environment Variables

Required:

- `RAG_API_BASE` - public wrapper base URL used by the Vercel proxy
- `RAG_API_KEY` - API key for the wrapper, used only server-side in the Vercel proxy

### Local Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│             Vercel CDN (live UI)                             │
│        (rag.orebit.id served via Caddy proxy)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + API Key
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VPS (orebit.id)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        RAG API Wrapper (Port 3004)               │   │
│  │  - Search endpoint                                │   │
│  │  - Browse endpoint                                │   │
│  │  - Stats endpoint                                 │   │
│  │  - Rate limiting (100 req/min)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                             │
│                              ▼                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Vector DB (local file)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Notes

- Frontend is static (HTML + JS + CSS)
- The Vercel serverless proxy handles authentication; the browser never sees the wrapper API key
- API wrapper handles rate limiting and data access
- Vector DB stays on VPS for security
- Public access is read-only via API wrapper
- The current live `rag.orebit.id` service is the Vercel-backed UI; the Streamlit showcase is rollback-only
