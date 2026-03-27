const { proxyRagRequest } = require('../_lib/rag-proxy')

module.exports = async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname
  const subpath = pathname.replace(/^\/api\/rag\/?/, '')
  return proxyRagRequest(req, res, subpath)
}
