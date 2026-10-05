# RAG Public Dashboard

A React interface for searching, browsing, and asking questions about an
academic-paper corpus. The interface calls a separate RAG API; the corpus and
answer service are not included in this repository.

[Hosted dashboard](https://rag.orebit.id) ·
[API wrapper source](https://github.com/ghoziankarami/rag-api-wrapper)

## Requirements

- Node.js 22+ and npm.
- A configured RAG API wrapper with an indexed corpus.
- For hosted deployments, a server-side API proxy such as the included Vercel functions.

A frontend build alone does not provide paper search or answers.

## Local development

Start the [API wrapper](https://github.com/ghoziankarami/rag-api-wrapper) on
`http://127.0.0.1:3004`, then run:

```bash
git clone https://github.com/ghoziankarami/rag-public.git
cd rag-public
npm ci
npm run dev
```

Open `http://localhost:3002`. Localhost requests use
`http://127.0.0.1:3004/api/rag`; deployed requests use the same-origin
`/api/rag` proxy.

## Build and deploy

```bash
npm run build
npm run preview
```

Build output is written to `dist/`. Vite preview serves static output; it does
not run the Vercel API functions. A deployed application needs both the static
frontend and the API proxy.

Import the repository into Vercel and configure these **server-side** variables:

| Variable | Purpose |
| --- | --- |
| `RAG_API_BASE` | Your wrapper URL, including `/api/rag`. |
| `RAG_API_KEY` | The key accepted by the wrapper. |

Do not prefix these keys with `VITE_`, put them in client code, or commit them.
The proxy forwards the API key to the wrapper without exposing it to the browser.
Configure your own domain through your hosting provider if needed.

## Repository

| Path | Contents |
| --- | --- |
| `src/` | React components and styles. |
| `api/rag/`, `api/_lib/` | Server-side endpoint handlers and shared proxy. |
| `vite.config.js` | Frontend development and build configuration. |
| `package-lock.json` | Locked npm dependencies. |
| `dist/`, `node_modules/` | Generated locally; do not commit. |

## Limitations

Search quality depends on corpus coverage and indexing. Generated answers can
be incomplete or incorrect; inspect cited papers before relying on a claim.
A retrieval score is a ranking signal, not a probability that an answer is correct.
Corpus content is subject to its own rights and access restrictions.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
Original dashboard code is licensed under [MIT](LICENSE). Dependencies and paper
content retain their own licences; the software licence does not grant rights
to redistribute the corpus.
