# RAG Public Dashboard

Public RAG search and browse dashboard for academic papers deployed on Vercel.

## Deploy to Vercel

### Prerequisites

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

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
   - `VITE_RAG_API_KEY`: Your API key for RAG API wrapper
   - Add via Vercel dashboard or CLI: `vercel env add VITE_RAG_API_KEY`

5. Configure custom domain (if needed):
   - Add `rag.orebit.id` in Vercel dashboard
   - Update DNS: `rag` → `cname.vercel-dns.com`

### API Connection

The frontend connects to RAG API wrapper running on VPS:

- **API Base URL**: `https://orebit.id/api/rag`
- **Endpoints**:
  - `GET /api/rag/stats` - Collection statistics
  - `POST /api/rag/search` - Vector similarity search
  - `GET /api/rag/browse` - Browse papers (paginated)
  - `GET /api/rag/health` - Health check

### Environment Variables

Required:

- `VITE_RAG_API_KEY` - API key for RAG API wrapper authentication

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
│                    Vercel CDN                              │
│                    (rag.orebit.id)                         │
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
- API wrapper handles authentication and rate limiting
- Vector DB stays on VPS for security
- Public access is read-only via API wrapper
