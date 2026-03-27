import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_BASE = isLocalhost ? 'http://127.0.0.1:3004/api/rag' : '/api/rag'

const QUICK_QUERIES = [
  'mineral exploration machine learning',
  'geology note cleanup workflow',
  'agent orchestration and automation',
  'open source mining system design',
  'field data fusion for remote sensing',
]

const FILTERS = ['All sources', 'Has DOI', 'No DOI', 'Recent (2024+)', 'Older papers']

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('en-US')
}

function scoreLabel(score) {
  if (score >= 0.85) return 'Excellent match'
  if (score >= 0.7) return 'Strong match'
  if (score >= 0.5) return 'Good match'
  return 'Supporting match'
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [stats, setStats] = useState(null)
  const [papers, setPapers] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('search')
  const [recentQueries, setRecentQueries] = useState([])
  const [browsePage, setBrowsePage] = useState(1)
  const [health, setHealth] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('All sources')
  const [browseYear, setBrowseYear] = useState('All years')

  useEffect(() => {
    fetchDashboardState()
    const timer = setInterval(fetchDashboardState, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchDashboardState() {
    try {
      const [statsRes, healthRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/health`),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data)
      }
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard state:', error)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/search`, {
        query: searchQuery,
        top_k: 12,
      })
      const results = response.data.results || []
      setSearchResults(results)
      setSelectedItem(results[0] || null)
      setRecentQueries((current) => [searchQuery.trim(), ...current.filter((item) => item !== searchQuery.trim())].slice(0, 6))
      setActiveTab('search')
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadBrowse(page = 1) {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/browse`, {
        params: { page, limit: 24 },
      })
      const papersData = response.data.papers || []
      setPapers(papersData)
      setBrowsePage(page)
      setSelectedItem(papersData[0] || null)
      setActiveTab('browse')
    } catch (error) {
      console.error('Browse failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const paperYears = useMemo(() => {
    const years = Array.from(new Set((papers || []).map((paper) => String(paper.year)).filter(Boolean)))
    return ['All years', ...years.sort((a, b) => Number(b) - Number(a))]
  }, [papers])

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      const yearNumber = Number(paper.year)
      const yearOk = browseYear === 'All years' || String(paper.year) === browseYear
      const sourceOk =
        sourceFilter === 'All sources' ||
        (sourceFilter === 'Has DOI' && Boolean(paper.doi)) ||
        (sourceFilter === 'No DOI' && !paper.doi) ||
        (sourceFilter === 'Recent (2024+)' && yearNumber >= 2024) ||
        (sourceFilter === 'Older papers' && yearNumber < 2024)
      return yearOk && sourceOk
    })
  }, [papers, browseYear, sourceFilter])

  const selectedMeta = selectedItem && (selectedItem.title || selectedItem.snippet)
    ? selectedItem
    : (searchResults[0] || papers[0] || null)

  const selectedLink = selectedMeta?.doi
    ? `https://doi.org/${selectedMeta.doi}`
    : selectedMeta?.url || selectedMeta?.source_ref || null

  const coreMetrics = [
    {
      label: 'Indexed chunks',
      value: formatNumber(stats?.collection_count ?? stats?.indexed_chunks ?? 0),
      note: 'vector corpus available for retrieval',
    },
    {
      label: 'Active papers',
      value: formatNumber(stats?.paper_count ?? stats?.active_papers ?? 0),
      note: 'papers surfaced for browse + search',
    },
    {
      label: 'Live health',
      value: health?.status || 'ok',
      note: health?.timestamp ? `checked ${new Date(health.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'wrapper status',
    },
    {
      label: 'Recent queries',
      value: recentQueries.length.toString().padStart(2, '0'),
      note: 'searches retained in the session',
    },
  ]

  return (
    <div className="rag-shell">
      <header className="rag-topbar">
        <div className="rag-brand">
          <div className="rag-brand-mark">R</div>
          <div>
            <p className="rag-kicker">Orebit RAG Workspace</p>
            <h1>RAG.orebit.id</h1>
          </div>
        </div>

        <div className="rag-topbar-actions">
          <span className={`rag-pill ${health?.status === 'ok' ? 'is-good' : 'is-warn'}`}>
            {health?.status === 'ok' ? 'Live wrapper healthy' : 'Health checking'}
          </span>
          <button className="rag-button secondary" onClick={fetchDashboardState} type="button">
            Refresh stats
          </button>
          <button className="rag-button primary" onClick={() => setActiveTab('search')} type="button">
            Search now
          </button>
        </div>
      </header>

      <main className="rag-main">
        <section className="rag-hero card-surface">
          <div className="rag-hero-copy">
            <p className="rag-kicker">Better than the old streamlit flow</p>
            <h2>Search, browse, and inspect evidence in one fast React dashboard.</h2>
            <p>
              Keep the same core RAG capabilities — search and browse — but layer them into a denser UI with live stats,
              recent queries, and evidence-focused cards that are actually pleasant to use.
            </p>
            <div className="rag-hero-actions">
              {QUICK_QUERIES.map((query) => (
                <button key={query} type="button" className="rag-chip" onClick={() => setSearchQuery(query)}>
                  {query}
                </button>
              ))}
            </div>
          </div>

          <div className="rag-hero-panel">
            {coreMetrics.map((metric) => (
              <article key={metric.label} className="rag-metric card-surface subtle">
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <span>{metric.note}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="rag-search card-surface">
          <form className="rag-searchbar" onSubmit={handleSearch}>
            <div className="rag-search-input-wrap">
              <span>⌕</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask the corpus something specific: thesis, project note, paper, or workflow..."
                aria-label="Search the RAG corpus"
              />
            </div>
            <button className="rag-button primary" type="submit" disabled={loading}>
              {loading && activeTab === 'search' ? 'Searching…' : 'Search corpus'}
            </button>
            <button className="rag-button secondary" type="button" onClick={() => loadBrowse(1)} disabled={loading}>
              Browse papers
            </button>
          </form>

          <div className="rag-tabbar">
            {['search', 'browse', 'insights'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rag-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab)
                  if (tab === 'browse' && !papers.length) loadBrowse(browsePage)
                }}
              >
                {tab === 'search' ? 'Search results' : tab === 'browse' ? 'Browse library' : 'Insights'}
              </button>
            ))}
          </div>
        </section>

        <section className="rag-content">
          <div className="rag-primary-column">
            {activeTab === 'search' && (
              <>
                <div className="section-head">
                  <div>
                    <p className="rag-kicker">Search response</p>
                    <h3>Evidence cards ranked by relevance</h3>
                  </div>
                  <div className="section-meta">
                    {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="rag-result-list">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <button
                        key={`${result.title}-${index}`}
                        type="button"
                        className={`rag-result card-surface ${selectedMeta?.title === result.title ? 'selected' : ''}`}
                        onClick={() => setSelectedItem(result)}
                      >
                        <div className="rag-result-head">
                          <div>
                            <span className="rag-result-rank">#{index + 1}</span>
                            <h4>{result.title}</h4>
                          </div>
                          <div className="rag-score">
                            {typeof result.score === 'number' ? result.score.toFixed(2) : '—'}
                            <small>{typeof result.score === 'number' ? scoreLabel(result.score) : 'Match score'}</small>
                          </div>
                        </div>
                        <p>{result.snippet}</p>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state card-surface subtle">
                      <strong>No search results yet.</strong>
                      <span>Try a specific query or use one of the quick prompts above.</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'browse' && (
              <>
                <div className="section-head">
                  <div>
                    <p className="rag-kicker">Library browse</p>
                    <h3>Scroll the indexed paper surface</h3>
                  </div>
                  <div className="section-meta">Page {browsePage}</div>
                </div>

                <div className="rag-filters card-surface subtle">
                  <label>
                    Year
                    <select value={browseYear} onChange={(e) => setBrowseYear(e.target.value)}>
                      {paperYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Paper lens
                    <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                      {FILTERS.map((filter) => (
                        <option key={filter} value={filter}>
                          {filter}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rag-browse-nav">
                    <button className="rag-button secondary" type="button" onClick={() => loadBrowse(Math.max(1, browsePage - 1))}>
                      Prev page
                    </button>
                    <button className="rag-button secondary" type="button" onClick={() => loadBrowse(browsePage + 1)}>
                      Next page
                    </button>
                  </div>
                </div>

                <div className="rag-paper-grid">
                  {filteredPapers.length > 0 ? (
                    filteredPapers.map((paper, index) => (
                      <button
                        key={`${paper.title}-${index}`}
                        type="button"
                        className={`rag-paper card-surface ${selectedMeta?.title === paper.title ? 'selected' : ''}`}
                        onClick={() => setSelectedItem(paper)}
                      >
                        <div className="rag-paper-top">
                          <span>{paper.year || '—'}</span>
                          {paper.doi ? <span>DOI</span> : <span>Paper</span>}
                        </div>
                        <h4>{paper.title}</h4>
                        <p>{paper.authors || paper.venue || 'No metadata returned'}</p>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state card-surface subtle">
                      <strong>No papers matched those filters.</strong>
                      <span>Change the year/source filters or load another browse page.</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'insights' && (
              <>
                <div className="section-head">
                  <div>
                    <p className="rag-kicker">Operational insights</p>
                    <h3>What the corpus is telling you</h3>
                  </div>
                  <div className="section-meta">Live summary</div>
                </div>

                <div className="rag-insight-grid">
                  <article className="card-surface subtle insight-card">
                    <span>Search quality</span>
                    <strong>{searchResults.length ? `${Math.min(100, Math.round((searchResults[0]?.score || 0) * 100))}%` : 'Ready'}</strong>
                    <p>Top result confidence is visible immediately so you can judge whether the answer is worth drilling into.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Corpus coverage</span>
                    <strong>{formatNumber(stats?.paper_count || 0)} papers</strong>
                    <p>Browse mode exposes the index surface and keeps the paper list close to the search flow.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Retrieval surface</span>
                    <strong>{formatNumber(stats?.collection_count || 0)} chunks</strong>
                    <p>The vector store count is made visible so users can judge whether the corpus is healthy or thin.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Session memory</span>
                    <strong>{recentQueries.length} recent</strong>
                    <p>Recent queries help the user resume a search thread without retyping everything from scratch.</p>
                  </article>
                </div>

                <div className="rag-history card-surface subtle">
                  <div className="section-head tight">
                    <div>
                      <p className="rag-kicker">Recent queries</p>
                      <h3>Jump back into the last few searches</h3>
                    </div>
                  </div>
                  <div className="history-list">
                    {recentQueries.length ? (
                      recentQueries.map((item) => (
                        <button key={item} type="button" className="history-chip" onClick={() => setSearchQuery(item)}>
                          {item}
                        </button>
                      ))
                    ) : (
                      <span className="empty-inline">No recent queries yet.</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="rag-sidebar">
            <div className="sidebar-stack card-surface">
              <div className="section-head tight">
                <div>
                  <p className="rag-kicker">Selected item</p>
                  <h3>Inspect the evidence</h3>
                </div>
                <div className="section-meta">Details</div>
              </div>
              {selectedMeta ? (
                <div className="selected-panel">
                  <h4>{selectedMeta.title}</h4>
                  {selectedMeta.snippet && <p>{selectedMeta.snippet}</p>}
                  {selectedLink && (
                    <div className="selected-link-row">
                      <a href={selectedLink} target="_blank" rel="noreferrer" className="rag-link-button">
                        Open source
                      </a>
                    </div>
                  )}
                  <div className="selected-meta">
                    {selectedMeta.score !== undefined && (
                      <div>
                        <span>Score</span>
                        <strong>{typeof selectedMeta.score === 'number' ? selectedMeta.score.toFixed(2) : '—'}</strong>
                      </div>
                    )}
                    {selectedMeta.year && (
                      <div>
                        <span>Year</span>
                        <strong>{selectedMeta.year}</strong>
                      </div>
                    )}
                    {selectedMeta.authors && (
                      <div>
                        <span>Authors</span>
                        <strong>{selectedMeta.authors}</strong>
                      </div>
                    )}
                    {selectedMeta.doi && (
                      <div>
                        <span>DOI</span>
                        <strong>{selectedMeta.doi}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-inline">Pick a result or paper to inspect it here.</div>
              )}
            </div>

            <div className="sidebar-stack card-surface subtle">
              <div className="section-head tight">
                <div>
                  <p className="rag-kicker">Quick actions</p>
                  <h3>Shortcuts that help day-to-day use</h3>
                </div>
              </div>
              <div className="quick-actions">
                <button className="rag-button secondary full" type="button" onClick={() => setActiveTab('search')}>
                  Open search mode
                </button>
                <button className="rag-button secondary full" type="button" onClick={() => setActiveTab('browse')}>
                  Open browse mode
                </button>
                <button className="rag-button secondary full" type="button" onClick={() => setActiveTab('insights')}>
                  Open insights
                </button>
              </div>
            </div>

            <div className="sidebar-stack card-surface subtle">
              <div className="section-head tight">
                <div>
                  <p className="rag-kicker">Live health</p>
                  <h3>Wrapper status & activity</h3>
                </div>
              </div>
              <div className="health-list">
                <div>
                  <span>Status</span>
                  <strong>{health?.status || 'unknown'}</strong>
                </div>
                <div>
                  <span>Timestamp</span>
                  <strong>{health?.timestamp ? new Date(health.timestamp).toLocaleString() : '—'}</strong>
                </div>
                <div>
                  <span>Recent paper browse</span>
                  <strong>{papers.length || 0} loaded</strong>
                </div>
                <div>
                  <span>Top filters</span>
                  <strong>{sourceFilter}</strong>
                </div>
              </div>
            </div>

            <div className="sidebar-stack card-surface subtle">
              <div className="section-head tight">
                <div>
                  <p className="rag-kicker">Browse hint</p>
                  <h3>Keep the corpus easy to navigate</h3>
                </div>
              </div>
              <p className="sidebar-copy">
                The React dashboard keeps the same core abilities as the older Streamlit version, but makes the search ↔ browse ↔ inspect loop much more obvious.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
