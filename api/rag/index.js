const { proxyRagRequest } = require('../_lib/rag-proxy')

module.exports = async (req, res) => proxyRagRequest(req, res, 'health')
