const { URL } = require('url')

function getConfig() {
  const apiBase = (process.env.RAG_API_BASE || 'https://api.orebit.id/api/rag').replace(/\/?$/, '/')
  const apiKey = process.env.RAG_API_KEY || ''
  return { apiBase, apiKey }
}

async function proxyRagRequest(req, res, subpath = '') {
  const { apiBase, apiKey } = getConfig()
  const pathname = String(subpath || '').replace(/^\/+/, '')
  const targetUrl = new URL(pathname, apiBase)

  if (req.url && req.url.includes('?')) {
    const query = req.url.split('?')[1]
    if (query) targetUrl.search = query
  }

  const headers = {
    'Content-Type': 'application/json'
  }

  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const init = {
    method: req.method,
    headers
  }

  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    if (typeof req.body === 'string') {
      init.body = req.body
    } else if (req.body && typeof req.body === 'object') {
      init.body = JSON.stringify(req.body)
    }
  }

  try {
    const upstream = await fetch(targetUrl.toString(), init)
    const contentType = upstream.headers.get('content-type') || 'application/json'
    const raw = await upstream.text()

    res.status(upstream.status)
    res.setHeader('Content-Type', contentType)
    if (upstream.headers.get('cache-control')) {
      res.setHeader('Cache-Control', upstream.headers.get('cache-control'))
    }

    if ((req.method || 'GET').toUpperCase() === 'HEAD') {
      return res.end()
    }

    if (!raw) {
      return res.end()
    }

    if (contentType.includes('application/json')) {
      try {
        return res.send(JSON.parse(raw))
      } catch (_parseError) {
        return res.send(raw)
      }
    }

    return res.send(raw)
  } catch (error) {
    console.error('[RAG PROXY] Request failed:', error)
    return res.status(502).json({ error: 'Bad gateway', message: String(error) })
  }
}

module.exports = { proxyRagRequest }
