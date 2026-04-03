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

const CONTEXT_CARDS = [
  {
    label: 'What is RAG?',
    title: 'Retrieval-Augmented Generation keeps answers grounded',
    body: 'Instead of answering from model memory alone, RAG first retrieves relevant papers and then composes an answer from those sources.',
  },
  {
    label: 'Why use it here?',
    title: 'Better for literature-heavy mining and geoscience work',
    body: 'This helps you compare methods, inspect evidence, and reduce hallucinated claims when the answer should come from papers, not guesses.',
  },
  {
    label: 'Best workflow',
    title: 'Ask, inspect sources, then open the paper detail',
    body: 'Use chat for synthesis, source cards for evidence, and the paper browser when you want to scan the collection directly.',
  },
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

function normalizePaperDetail(record) {
  if (!record) return null
  return {
    ...record,
    snippet: record.snippet || record.definition_snippet || 'No summary available.',
    title: record.title || record.display_title || record.citation || 'Untitled paper',
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [showBrowse, setShowBrowse] = useState(true)
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
    if (showBrowse && !papers.length) {
      loadBrowse(1)
    }
  }, [showBrowse])

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

  function openPaperDetail(paper) {
    setSourceDetail(normalizePaperDetail(paper))
  }

  const paperCount = stats?.fulltext_papers ?? stats?.paper_count ?? 0
  const chunkCount = stats?.collection_count ?? stats?.indexed_chunks ?? 0
  const summaryCount = stats?.summary_count ?? 0

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">O</div>
            <div className="brand-copy">
              <span className="brand-kicker">Orebit Research</span>
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
        <section className="hero-shell">
          <article className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Grounded research assistant</span>
              <h2>Ask, retrieve, and inspect paper-backed answers.</h2>
              <p>
                RAG stands for Retrieval-Augmented Generation. This app first retrieves the most relevant papers from the Orebit collection, then builds an answer from those sources so you can inspect the evidence instead of trusting a generic model response.
              </p>
              <div className="hero-points">
                <div className="hero-point">
                  <span className="hero-point-bullet" />
                  <span><strong>Use chat</strong> when you want a fast synthesis across many papers.</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point-bullet" />
                  <span><strong>Use the source list</strong> when you need to verify which papers support the answer.</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point-bullet" />
                  <span><strong>Use the library browser</strong> when you want to explore the corpus directly, not through a single question.</span>
                </div>
              </div>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="hero-caption">
                Best for literature review, method comparison, and paper-backed technical answers.
              </div>
            </div>
          </article>

          <aside className="hero-aside">
            <div className="hero-stat-grid">
              <div className="hero-stat">
                <span className="hero-stat-label">Indexed papers</span>
                <strong>{formatNumber(paperCount)}</strong>
                <small>Full-text research records available for retrieval.</small>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Search chunks</span>
                <strong>{formatNumber(chunkCount)}</strong>
                <small>Vectorized chunks used to find relevant evidence.</small>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Summaries</span>
                <strong>{formatNumber(summaryCount)}</strong>
                <small>Records that already include machine-readable summaries.</small>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Mode</span>
                <strong>Read-only</strong>
                <small>Public browsing and question answering without editing the corpus.</small>
              </div>
            </div>
            <div className="hero-note">
              <h3>Why not just use a normal chatbot?</h3>
              <p>
                For literature review, estimation methods, and technical comparison, grounded retrieval usually beats memory-only answers because you can trace claims back to actual papers.
              </p>
            </div>
          </aside>
        </section>

        <section className="context-grid">
          {CONTEXT_CARDS.map((card) => (
            <article key={card.label} className="context-card">
              <span className="context-label">{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="chat-shell">
          <div className="section-head">
            <div>
              <h3>Research chat</h3>
              <p>Ask a question, then inspect the supporting evidence below each answer.</p>
            </div>
            <span className="section-pill">Cited answers</span>
          </div>

          <div className="chat-area">
            {messages.length === 0 && !loading && (
              <div className="welcome">
                <h2>Start with a research question</h2>
                <p>
                  Ask about geostatistics, remote sensing, ore estimation, mining systems, or any topic covered by the indexed paper collection.
                </p>
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
                      {msg.sources.length} supporting source{msg.sources.length > 1 ? 's' : ''} {selectedSource === i ? '▾' : '▸'}
                    </button>
                    {selectedSource === i && (
                      <div className="sources-list">
                        {msg.sources.map((src, j) => (
                          <button key={j} className="source-card source-card-button" onClick={() => setSourceDetail(normalizePaperDetail(src))}>
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
        </section>

        <section className="library-shell">
          <div className="library-head">
            <div>
              <h3>Paper library</h3>
              <p>Browse the corpus directly in a detailed list view. Open a row to inspect the summary and metadata.</p>
            </div>
            <div className="library-actions">
              <button className="browse-toggle full-width" onClick={toggleBrowse}>
                {showBrowse ? 'Hide library' : `Browse ${formatNumber(stats?.indexed_papers ?? 0)} papers`}
              </button>
            </div>
          </div>

          {showBrowse && (
            <div className="browse-panel">
              {browseLoading ? (
                <p className="browse-loading">Loading papers...</p>
              ) : (
                <>
                  <div className="paper-list">
                    {papers.map((p, i) => (
                      <button key={i} className="paper-row" type="button" onClick={() => openPaperDetail(p)}>
                        <div className="paper-row-main">
                          <div className="paper-row-kickers">
                            <span className="paper-kicker kind">{p.kind || 'paper'}</span>
                            {p.has_summary && <span className="paper-kicker summary">summary ready</span>}
                            <span className="paper-kicker year">{p.year || 'year unknown'}</span>
                          </div>
                          <h4>{p.title || p.display_title || p.citation || 'Untitled'}</h4>
                          <p className="paper-citation">{p.citation || p.display_title || p.title || 'No citation available.'}</p>
                          {(p.snippet || p.authors) && (
                            <p className="paper-snippet">{p.snippet || p.authors}</p>
                          )}
                        </div>
                        <div className="paper-row-side">
                          <div className="paper-side-block">
                            <strong>Authors</strong>
                            <span>{p.authors || 'Unknown authorship'}</span>
                          </div>
                          <div className="paper-side-block">
                            <strong>Collection info</strong>
                            <span>{p.chunk_count ? `${p.chunk_count} chunks` : p.has_summary ? 'Summary record' : 'Metadata record'}</span>
                          </div>
                          <div className="paper-links">
                            <span className="paper-secondary-link">Open detail</span>
                            {p.doi && (
                              <a
                                href={`https://doi.org/${p.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="paper-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                DOI ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </button>
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
        </section>
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

      <div className="input-bar">
        <form id="ask-form" className="input-form" onSubmit={handleAsk}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask about geostatistics, mining, geology, remote sensing, or a specific paper..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !query.trim()} className="send-btn">
            {loading ? '...' : '→'}
          </button>
        </form>
      </div>

      <footer className="footer">
        <span>Powered by <a href="https://orebit.id" target="_blank" rel="noreferrer">Orebit.id</a> · Open Source Mining Technology</span>
      </footer>
    </div>
  )
}

export default App
