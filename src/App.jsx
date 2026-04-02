import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_BASE = isLocalhost ? 'http://127.0.0.1:3004/api/rag' : '/api/rag'

const SUGGESTIONS = [
  'What is kriging interpolation?',
  'Compare ML vs geostatistics for ore estimation',
  'Tin deposit formation in Bangka Island',
  'Physics-informed neural networks in geoscience',
  'Remote sensing for mineral exploration',
]

function scoreColor(score) {
  if (score >= 0.85) return 'var(--score-excellent)'
  if (score >= 0.7) return 'var(--score-strong)'
  if (score >= 0.5) return 'var(--score-good)'
  return 'var(--score-fair)'
}

function scoreLabel(score) {
  if (score >= 0.85) return 'Excellent'
  if (score >= 0.7) return 'Strong'
  if (score >= 0.5) return 'Good'
  return 'Fair'
}

function formatNumber(v) {
  if (v == null || isNaN(Number(v))) return '0'
  return Number(v).toLocaleString('en-US')
}

function App() {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [showBrowse, setShowBrowse] = useState(false)
  const [papers, setPapers] = useState([])
  const [browsePage, setBrowsePage] = useState(1)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState(null)
  const [sourceDetail, setSourceDetail] = useState(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function fetchStats() {
    try {
      const res = await axios.get(`${API_BASE}/stats`)
      setStats(res.data)
    } catch (e) {
      console.error('Stats fetch failed:', e)
    }
  }

  async function handleAsk(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q || loading) return

    setMessages(prev => [...prev, { role: 'user', content: q }])
    setQuery('')
    setLoading(true)

    try {
      // Build conversation history for follow-up context (last 6 messages max)
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }))
      const res = await axios.post(`${API_BASE}/answer`, { query: q, top_k: 5, history })
      const answer = res.data?.answer || 'No answer generated.'
      const sources = res.data?.sources || []
      setMessages(prev => [...prev, { role: 'assistant', content: answer, sources }])
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || 'Request failed'
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errMsg}`, sources: [] }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleSuggestion(text) {
    setQuery(text)
    setTimeout(() => {
      const form = document.getElementById('ask-form')
      if (form) form.requestSubmit()
    }, 50)
  }

  async function loadBrowse(page = 1) {
    setBrowseLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/browse`, { params: { page, limit: 20 } })
      setPapers(res.data?.papers || [])
      setBrowsePage(page)
    } catch (e) {
      console.error('Browse failed:', e)
    } finally {
      setBrowseLoading(false)
    }
  }

  function toggleBrowse() {
    const next = !showBrowse
    setShowBrowse(next)
    if (next && !papers.length) loadBrowse(1)
  }

  const paperCount = stats?.fulltext_papers ?? stats?.paper_count ?? 0
  const chunkCount = stats?.collection_count ?? stats?.indexed_chunks ?? 0

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">O</div>
            <div>
              <h1 className="brand-name">Orebit RAG</h1>
              <p className="brand-sub">
                {formatNumber(paperCount)} papers · {formatNumber(chunkCount)} chunks
              </p>
            </div>
          </div>
          <a href="https://orebit.id" target="_blank" rel="noreferrer" className="header-link">
            orebit.id ↗
          </a>
        </div>
      </header>

      <main className="main">
        {/* Chat area */}
        <div className="chat-area">
          {messages.length === 0 && !loading && (
            <div className="welcome">
              <h2>Ask anything about geological research</h2>
              <p>
                Search {formatNumber(paperCount)} peer-reviewed papers with AI-powered answers and source citations.
              </p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="message-label">{msg.role === 'user' ? 'You' : 'Orebit AI'}</div>
              <div className="message-content">{msg.content}</div>
              {msg.sources?.length > 0 && (
                <div className="sources">
                  <button
                    className="sources-toggle"
                    onClick={() => setSelectedSource(selectedSource === i ? null : i)}
                  >
                    📚 {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} {selectedSource === i ? '▾' : '▸'}
                  </button>
                  {selectedSource === i && (
                    <div className="sources-list">
                      {msg.sources.map((src, j) => (
                        <button key={j} className="source-card source-card-button" onClick={() => setSourceDetail(src)}>
                          <div className="source-head">
                            <span className="source-title">
                              {src.title || src.display_title || src.citation || `Source ${j + 1}`}
                            </span>
                            {typeof src.score === 'number' && (
                              <span className="score-badge" style={{ background: scoreColor(src.score) }}>
                                {(src.score * 100).toFixed(0)}% · {scoreLabel(src.score)}
                              </span>
                            )}
                          </div>
                          {(src.definition_snippet || src.snippet) && <p className="source-snippet">{src.definition_snippet || src.snippet}</p>}
                          <div className="source-meta">
                            {src.year && <span>{src.year}</span>}
                            {src.authors && <span>{src.authors}</span>}
                            {src.doi && (
                              <a href={`https://doi.org/${src.doi}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                DOI ↗
                              </a>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              <div className="message-label">Orebit AI</div>
              <div className="message-content loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input bar — fixed at bottom of main */}
        <div className="input-bar">
          <form id="ask-form" className="input-form" onSubmit={handleAsk}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask about geostatistics, mining, geology..."
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !query.trim()} className="send-btn">
              {loading ? '...' : '→'}
            </button>
          </form>
        </div>

        {/* Browse toggle */}
        <div className="browse-section">
          <button className="browse-toggle" onClick={toggleBrowse}>
            {showBrowse ? '▾ Hide Library' : '📚 Browse Paper Library'}
          </button>

          {showBrowse && (
            <div className="browse-panel">
              {browseLoading ? (
                <p className="browse-loading">Loading papers...</p>
              ) : (
                <>
                  <div className="browse-grid">
                    {papers.map((p, i) => (
                      <div key={i} className="paper-card">
                        <div className="paper-top">
                          <span className="paper-year">{p.year || '—'}</span>
                          {p.doi && <span className="paper-doi-badge">DOI</span>}
                        </div>
                        <h4>{p.citation || p.display_title || p.title || 'Untitled'}</h4>
                        <p className="paper-authors">{p.authors || ''}</p>
                        {p.doi && (
                          <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="paper-link">
                            View DOI ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="browse-nav">
                    <button onClick={() => loadBrowse(Math.max(1, browsePage - 1))} disabled={browsePage <= 1}>
                      ← Prev
                    </button>
                    <span>Page {browsePage}</span>
                    <button onClick={() => loadBrowse(browsePage + 1)}>
                      Next →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {sourceDetail && (
        <div className="modal-backdrop" onClick={() => setSourceDetail(null)}>
          <div className="source-modal" onClick={(e) => e.stopPropagation()}>
            <div className="source-modal-head">
              <div>
                <h3>{sourceDetail.title || sourceDetail.display_title || sourceDetail.citation || 'Paper detail'}</h3>
                <div className="source-modal-meta">
                  {sourceDetail.year && <span>{sourceDetail.year}</span>}
                  {sourceDetail.authors && <span>{sourceDetail.authors}</span>}
                  {typeof sourceDetail.score === 'number' && <span>{(sourceDetail.score * 100).toFixed(0)}% match</span>}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSourceDetail(null)}>✕</button>
            </div>

            <div className="source-modal-section">
              <div className="section-label">Summary</div>
              <p>{sourceDetail.snippet || 'No summary available.'}</p>
            </div>

            {sourceDetail.definition_snippet && sourceDetail.definition_snippet !== sourceDetail.snippet && (
              <div className="source-modal-section">
                <div className="section-label">Evidence used</div>
                <p>{sourceDetail.definition_snippet}</p>
              </div>
            )}

            <div className="source-modal-section">
              <div className="section-label">Metadata</div>
              <div className="detail-grid">
                <div><strong>Title</strong><span>{sourceDetail.title || '—'}</span></div>
                <div><strong>Authors</strong><span>{sourceDetail.authors || '—'}</span></div>
                <div><strong>Year</strong><span>{sourceDetail.year || '—'}</span></div>
                <div><strong>DOI</strong><span>{sourceDetail.doi || '—'}</span></div>
              </div>
            </div>

            {sourceDetail.doi && (
              <div className="source-modal-actions">
                <a href={`https://doi.org/${sourceDetail.doi}`} target="_blank" rel="noreferrer" className="detail-link">
                  Open DOI ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <span>Powered by <a href="https://orebit.id" target="_blank" rel="noreferrer">Orebit.id</a> · Open Source Mining Technology</span>
      </footer>
    </div>
  )
}

export default App
