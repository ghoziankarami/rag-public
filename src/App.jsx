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
    label: 'Step 1',
    title: 'Ask in plain language',
    body: 'Start with the question you actually need answered.',
  },
  {
    label: 'Step 2',
    title: 'Check the cited sources',
    body: 'Open the evidence trail before trusting the answer.',
  },
  {
    label: 'Step 3',
    title: 'Browse for deeper context',
    body: 'Use the library when you want the broader corpus view.',
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

function corpusTrustLabel(stats) {
  if (!stats) return 'Loading'
  if (stats.peer_reviewed_ok) return 'Healthy'
  if ((stats.arxiv_violations ?? 0) > 0) return 'Needs cleanup'
  if ((stats.parity_gap ?? 0) > 0) return 'Parity catch-up'
  return 'Review'
}

function cleanDisplayText(text) {
  if (!text) return ''
  return String(text)
    .replace(/<\/?jats:[^>]+>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactAuthors(authors) {
  const clean = cleanDisplayText(authors)
  if (!clean) return 'Unknown authorship'
  if (clean.length <= 84) return clean
  const parts = clean
    .split(/\s*(?:;|, & | & | and )\s*/)
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) return `${clean.slice(0, 80).trim()}…`
  const visible = parts.slice(0, 3)
  return `${visible.join(', ')}, et al.`
}

function paperMetaLine(paper) {
  const authors = compactAuthors(paper.authors)
  const year = cleanDisplayText(paper.year)
  const journal = cleanDisplayText(paper.journal)
  const parts = []
  if (authors && authors !== 'Unknown authorship') parts.push(authors)
  if (year) parts.push(year)
  if (journal) parts.push(journal)
  return parts.join(' · ') || 'Metadata record'
}

function normalizePaperDetail(record) {
  if (!record) return null
  return {
    ...record,
    snippet: cleanDisplayText(record.snippet || record.definition_snippet || 'No summary available.'),
    obsidian_summary: cleanDisplayText(record.obsidian_summary || ''),
    obsidian_note_path: cleanDisplayText(record.obsidian_note_path || ''),
    obsidian_key_findings: Array.isArray(record.obsidian_key_findings)
      ? record.obsidian_key_findings.map((item) => cleanDisplayText(item)).filter(Boolean)
      : [],
    title: cleanDisplayText(record.title || record.display_title || record.citation || 'Untitled paper'),
  }
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
    if (showBrowse && !papers.length) {
      loadBrowse(1)
    }
  }, [showBrowse])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function scrollToSection(id) {
    if (typeof document === 'undefined') return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function focusComposer(seed = '') {
    if (seed) {
      setQuery(seed)
    }
    setTimeout(() => {
      inputRef.current?.focus()
      scrollToSection('research-chat')
    }, 40)
  }

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
      const res = await axios.get(`${API_BASE}/browse`, { params: { page, limit: 10 } })
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

  function openLibrary() {
    if (!showBrowse) {
      setShowBrowse(true)
      if (!papers.length) loadBrowse(1)
    }
    setTimeout(() => {
      scrollToSection('paper-library')
    }, 40)
  }

  function openPaperDetail(paper) {
    setSourceDetail(normalizePaperDetail(paper))
  }

  const paperCount = stats?.fulltext_papers ?? stats?.paper_count ?? 0
  const chunkCount = stats?.collection_count ?? stats?.indexed_chunks ?? 0
  const summaryCount = stats?.summary_count ?? 0
  const corpusTrust = corpusTrustLabel(stats)

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark">O</div>
            <div className="brand-copy">
              <span className="brand-kicker">Orebit Open Source Initiative</span>
              <h1 className="brand-name">Orebit RAG</h1>
              <p className="brand-sub">
                {formatNumber(paperCount)} papers · {formatNumber(chunkCount)} chunks
              </p>
            </div>
          </div>
          <nav className="header-nav" aria-label="Public navigation">
            <button type="button" className="header-nav-link" onClick={() => scrollToSection('how-it-works')}>
              How it works
            </button>
            <button type="button" className="header-nav-link" onClick={() => scrollToSection('research-chat')}>
              Ask
            </button>
            <button type="button" className="header-nav-link" onClick={openLibrary}>
              Library
            </button>
            <a href="https://github.com/ghoziankarami/orebit-showcase" target="_blank" rel="noreferrer" className="header-nav-link">
              GitHub
            </a>
          </nav>
          <a href="https://orebit.id" target="_blank" rel="noreferrer" className="header-link header-link-primary">
            Open orebit.id ↗
          </a>
        </div>
      </header>

      <main className="main">
        <section className="hero-shell">
          <article className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">Public research interface</span>
              <h2>Paper-backed answers for mining and geoscience work.</h2>
              <p>
                Ask research questions, inspect cited evidence, and browse the indexed paper collection in one public interface.
              </p>
              <div className="hero-actions">
                <button type="button" className="hero-action hero-action-primary" onClick={() => focusComposer(SUGGESTIONS[0])}>
                  Ask a question
                </button>
                <button type="button" className="hero-action" onClick={openLibrary}>
                  Browse library
                </button>
                <a href="https://orebit.id/#projects" target="_blank" rel="noreferrer" className="hero-action hero-action-link">
                  Open showcase
                </a>
              </div>
              <div className="suggestions">
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <aside className="hero-aside">
            <div className="hero-stat-grid">
              <div className="hero-stat">
                <span className="hero-stat-label">Papers</span>
                <strong>{formatNumber(paperCount)}</strong>
                <small>Indexed and searchable.</small>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Chunks</span>
                <strong>{formatNumber(chunkCount)}</strong>
                <small>Used for retrieval.</small>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-label">Mode</span>
                <strong>Read-only</strong>
                <small>Public research surface.</small>
              </div>
            </div>
            <div className="hero-note">
              <h3>Public and read-only</h3>
              <p>
                Research access only. No internal ops, admin, or monitoring data.
              </p>
            </div>
            <div className="hero-note">
              <h3>Corpus trust: {corpusTrust}</h3>
              <p>
                Peer-reviewed parity gap: {formatNumber(stats?.parity_gap ?? 0)} · arXiv policy violations: {formatNumber(stats?.arxiv_violations ?? 0)} · summaries: {formatNumber(summaryCount)}.
              </p>
            </div>
          </aside>
          <div className="hero-flow section-anchor" id="how-it-works">
            <div className="hero-flow-head">
              <div className="section-intro section-intro-tight">
                <span className="section-kicker">How it works</span>
                <h2 className="section-title section-title-compact">Ask, verify, then browse deeper.</h2>
              </div>
              <p className="section-description hero-flow-description">
                A simple flow for grounded research.
              </p>
            </div>
            <div className="context-grid context-grid-compact">
              {CONTEXT_CARDS.map((card) => (
                <article key={card.label} className="context-card">
                  <span className="context-label">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="chat-shell section-anchor" id="research-chat">
          <div className="section-head">
            <div>
              <span className="section-kicker">Ask</span>
              <h2 className="section-title section-title-compact">Research chat</h2>
              <p className="section-description">Ask a question first, then inspect the supporting evidence under each answer.</p>
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
                            {(src.definition_snippet || src.snippet) && <p className="source-snippet">{cleanDisplayText(src.definition_snippet || src.snippet)}</p>}
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

        <section className="library-shell section-anchor" id="paper-library">
          <div className="library-head">
            <div>
              <span className="section-kicker">Library</span>
              <h2 className="section-title section-title-compact">Paper library</h2>
              <p className="section-description">Browse the corpus in a compact list, then open a row only when you need the full summary and metadata.</p>
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
                  <div className="library-mode-note">
                    Showing 10 papers at a time in compact browse mode.
                  </div>
                  <div className="paper-list">
                    {papers.map((p, i) => (
                      <button key={i} className="paper-row" type="button" onClick={() => openPaperDetail(p)}>
                        <div className="paper-row-main">
                          <div className="paper-row-kickers">
                            <span className="paper-kicker kind">{p.kind || 'paper'}</span>
                            {p.has_summary && <span className="paper-kicker summary">summary ready</span>}
                            <span className="paper-kicker year">{p.year || 'year unknown'}</span>
                          </div>
                          <h4>{cleanDisplayText(p.title || p.display_title || p.citation || 'Untitled')}</h4>
                          <p className="paper-citation">{paperMetaLine(p)}</p>
                        </div>
                        <div className="paper-row-side">
                          <div className="paper-side-block">
                            <strong>Authors</strong>
                            <span title={cleanDisplayText(p.authors || 'Unknown authorship')}>{compactAuthors(p.authors)}</span>
                          </div>
                          <div className="paper-side-block">
                            <strong>Indexed as</strong>
                            <span>
                              {p.chunk_count && !p.chunk_count_estimated
                                ? `${p.chunk_count} chunks`
                                : p.indexed_fulltext
                                  ? 'Full-text indexed'
                                  : p.has_summary
                                    ? 'Summary record'
                                    : 'Metadata record'}
                            </span>
                          </div>
                          <div className="paper-links">
                            <span className="paper-secondary-link">Inspect</span>
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
              <p>{sourceDetail.obsidian_summary || sourceDetail.snippet || 'No summary available.'}</p>
            </div>

            {sourceDetail.obsidian_key_findings?.length > 0 && (
              <div className="source-modal-section">
                <div className="section-label">Key findings</div>
                <ul className="source-findings-list">
                  {sourceDetail.obsidian_key_findings.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {sourceDetail.definition_snippet && sourceDetail.definition_snippet !== sourceDetail.snippet && (
              <div className="source-modal-section">
                <div className="section-label">Evidence used</div>
                <p>{cleanDisplayText(sourceDetail.definition_snippet)}</p>
              </div>
            )}

            <div className="source-modal-section">
              <div className="section-label">Metadata</div>
              <div className="detail-grid">
                <div><strong>Title</strong><span>{sourceDetail.title || '—'}</span></div>
                <div><strong>Authors</strong><span>{sourceDetail.authors || '—'}</span></div>
                <div><strong>Year</strong><span>{sourceDetail.year || '—'}</span></div>
                <div><strong>DOI</strong><span>{sourceDetail.doi || '—'}</span></div>
                {sourceDetail.obsidian_note_path && <div><strong>Obsidian note</strong><span>{sourceDetail.obsidian_note_path}</span></div>}
              </div>
            </div>

            {sourceDetail.doi && (
              <div className="source-modal-actions">
                <a href={`https://doi.org/${sourceDetail.doi}`} target="_blank" rel="noreferrer" className="detail-link">
                  Open DOI ↗
                </a>
                {sourceDetail.obsidian_uri && (
                  <a href={sourceDetail.obsidian_uri} className="detail-link detail-link-secondary">
                    Open in Obsidian ↗
                  </a>
                )}
              </div>
            )}
            {!sourceDetail.doi && sourceDetail.obsidian_uri && (
              <div className="source-modal-actions">
                <a href={sourceDetail.obsidian_uri} className="detail-link detail-link-secondary">
                  Open in Obsidian ↗
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
        <span>Powered by <a href="https://orebit.id" target="_blank" rel="noreferrer">Orebit.id</a> · Public research surface in the Orebit showcase</span>
      </footer>
    </div>
  )
}

export default App
