import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_BASE = isLocalhost ? 'http://127.0.0.1:3004/api/rag' : '/api/rag'

const QUICK_QUERIES = [
  'geostatistics uncertainty',
  'gravity anomaly interpretation',
  'mineral exploration machine learning',
  'physics-informed geoscience',
  'remote sensing data fusion',
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

function paperLabel(item) {
  if (!item) return ''
  return item.citation || item.display_title || item.title || item.source || ''
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
  const [sourceFilter, setSourceFilter] = useState('All sources')
  const [browseYear, setBrowseYear] = useState('All years')
  const [answerQuery, setAnswerQuery] = useState('')
  const [answerResult, setAnswerResult] = useState(null)
  const [answerLoading, setAnswerLoading] = useState(false)
  const [answerError, setAnswerError] = useState('')

  useEffect(() => {
    fetchDashboardState()
    const timer = setInterval(fetchDashboardState, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchDashboardState() {
    try {
      const statsRes = await axios.get(`${API_BASE}/stats`)
      setStats(statsRes.data)
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

  async function handleAsk(e) {
    e.preventDefault()
    if (!answerQuery.trim()) return

    setAnswerLoading(true)
    setAnswerError('')
    try {
      const response = await axios.post(`${API_BASE}/answer`, {
        query: answerQuery,
        top_k: 5,
      })
      setAnswerResult(response.data)
      setRecentQueries((current) => [answerQuery.trim(), ...current.filter((item) => item !== answerQuery.trim())].slice(0, 6))
      setActiveTab('search')
    } catch (error) {
      console.error('Ask failed:', error)
      setAnswerError(error?.response?.data?.message || error?.message || 'LLM answer failed')
    } finally {
      setAnswerLoading(false)
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
      label: 'Full-text papers',
      value: formatNumber(stats?.fulltext_papers ?? stats?.paper_count ?? 0),
      note: 'papers with real full-text chunks in the public corpus',
    },
    {
      label: 'Metadata-only records',
      value: formatNumber(stats?.metadata_only_records ?? 0),
      note: 'browseable records that do not yet have full-text chunks',
    },
    {
      label: 'Chunks',
      value: formatNumber(stats?.collection_count ?? stats?.indexed_chunks ?? 0),
      note: 'full-text chunks available for retrieval',
    },
    {
      label: 'Public records',
      value: formatNumber(stats?.indexed_papers ?? 0),
      note: 'full-text + metadata-only records combined',
    },
  ]

  return (
    <div className="rag-shell">
      <header className="rag-topbar">
        <div className="rag-brand">
          <div className="rag-brand-mark">R</div>
          <div>
            <p className="rag-kicker">Public paper corpus</p>
            <h1>RAG.orebit.id</h1>
          </div>
        </div>
      </header>

      <main className="rag-main">
        <section className="rag-hero card-surface">
          <div className="rag-hero-copy">
            <div>
              <p className="rag-kicker">Public paper library</p>
              <h2>Mulai dari pertanyaan, lalu telusuri evidence yang paling relevan.</h2>
              <p>
                RAG sekarang diselaraskan dengan Mission: masuk dari hero yang jelas, lihat snapshot corpus,
                lalu lanjut ke search, browse, atau answer sesuai kebutuhan.
              </p>
            </div>
            <div className="rag-hero-actions">
              <button className="rag-button primary" type="button" onClick={() => setActiveTab('search')}>
                Start Searching
              </button>
              <button className="rag-button secondary" type="button" onClick={() => { setActiveTab('browse'); if (!papers.length) loadBrowse(browsePage) }}>
                Browse Library
              </button>
            </div>
          </div>

          <div className="rag-hero-highlight">
            <span className="rag-hero-highlight-label">Corpus snapshot</span>
            <strong>{formatNumber(stats?.indexed_papers ?? stats?.paper_count ?? 0)} public records available</strong>
            <p>
              {formatNumber(stats?.collection_count ?? stats?.indexed_chunks ?? 0)} chunks siap dipakai untuk retrieval dan jawaban berbasis evidence.
            </p>
          </div>
        </section>

        <section className="rag-public-assurance card-surface subtle">
          <div>
            <p className="rag-kicker">Public-only surface</p>
            <h3>Tidak ada monitoring internal di dashboard ini.</h3>
            <p>
              RAG hanya menampilkan metrik corpus yang aman untuk publik: jumlah paper, jumlah chunk, volume pencarian publik,
              dan pengalaman penelusuran. Status backup, cron, security, dan biaya tetap tinggal di dashboard internal.
            </p>
          </div>
          <div className="rag-public-metrics">
            {coreMetrics.map((metric) => (
              <article key={metric.label} className="rag-public-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rag-unified card-surface">
          <div className="rag-tabbar inline">
            <button
              type="button"
              className={`rag-tab ${activeTab === 'search' || activeTab === 'ask' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Search
            </button>
            <button
              type="button"
              className={`rag-tab ${activeTab === 'ask' ? 'active' : ''}`}
              onClick={() => setActiveTab('ask')}
            >
              Ask LLM
            </button>
            <button
              type="button"
              className={`rag-tab ${activeTab === 'browse' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('browse')
                if (!papers.length) loadBrowse(browsePage)
              }}
            >
              Browse
            </button>
            <button
              type="button"
              className={`rag-tab ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              Insights
            </button>
          </div>

          {(activeTab === 'search' || activeTab === 'ask') && (
            <form className="rag-mainbar" onSubmit={activeTab === 'ask' ? handleAsk : handleSearch}>
              <div className="rag-search-input-wrap large">
                <span>{activeTab === 'ask' ? '✦' : '⌕'}</span>
                <input
                  value={activeTab === 'ask' ? answerQuery : searchQuery}
                  onChange={(e) => activeTab === 'ask' ? setAnswerQuery(e.target.value) : setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'ask' ? "Ask a paper question, e.g. 'What does Caers 2025 focus on?'" : "Ask about a paper, topic, author, or method..."}
                  aria-label={activeTab === 'ask' ? "Ask the paper corpus" : "Search the RAG corpus"}
                />
              </div>
              <button className="rag-button primary large" type="submit" disabled={activeTab === 'ask' ? answerLoading : loading}>
                {activeTab === 'ask' ? (answerLoading ? 'Thinking…' : 'Ask') : (loading && activeTab === 'search' ? 'Searching…' : 'Search')}
              </button>
              {activeTab === 'ask' && (
                <button
                  className="rag-button secondary"
                  type="button"
                  onClick={() => setAnswerQuery(searchQuery)}
                  disabled={answerLoading}
                >
                  Use search query
                </button>
              )}
            </form>
          )}

          {activeTab === 'ask' && answerError && <div className="rag-inline-error">{answerError}</div>}

          {activeTab === 'ask' && answerResult?.answer && (
            <div className="rag-answer card-surface subtle">
              <div className="rag-answer-copy">
                <strong>Answer</strong>
                <p>{answerResult.answer}</p>
              </div>
              {!!answerResult.sources?.length && (
                <div className="rag-answer-sources">
                  <span className="rag-answer-label">Sources</span>
                  <div className="history-list">
                    {answerResult.sources.map((source, index) => (
                      <button
                        key={`${source.id || source.title || source.source || index}`}
                        type="button"
                        className="history-chip"
                        onClick={() => setSelectedItem(source)}
                      >
                        {paperLabel(source) || `Source ${index + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rag-content">
          <div className="rag-primary-column">
            {activeTab === 'search' && (
              <>
                <div className="section-head">
                  <div>
                    <p className="rag-kicker">Search results</p>
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
                        key={`${result.id || result.title}-${index}`}
                        type="button"
                        className={`rag-result card-surface ${selectedMeta?.id === result.id ? 'selected' : ''}`}
                        onClick={() => setSelectedItem(result)}
                      >
                        <div className="rag-result-head">
                          <div className="rag-result-title-area">
                            <span className="rag-result-rank">#{index + 1}</span>
                            <h4>{paperLabel(result)}</h4>
                          </div>
                          <div className="rag-score-badge">
                            <strong>{typeof result.score === 'number' ? result.score.toFixed(2) : '—'}</strong>
                            <small>{typeof result.score === 'number' ? scoreLabel(result.score) : 'Match score'}</small>
                          </div>
                        </div>
                        {result.doi && (
                          <div className="rag-result-doi">
                            <span>DOI: </span>
                            <a href={`https://doi.org/${result.doi}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                              {result.doi}
                            </a>
                          </div>
                        )}
                        <p className="rag-result-snippet">{result.snippet}</p>
                        {result.year && (
                          <div className="rag-result-meta">
                            <span>{result.year}</span>
                            {result.authors && <span>{result.authors}</span>}
                          </div>
                        )}
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
                        key={`${paper.id || paper.title}-${index}`}
                        type="button"
                        className={`rag-paper card-surface ${selectedMeta?.id === paper.id ? 'selected' : ''}`}
                        onClick={() => setSelectedItem(paper)}
                      >
                        <div className="rag-paper-top">
                          <span className="rag-paper-year">{paper.year || '—'}</span>
                          <span className={`rag-paper-type ${paper.doi ? 'has-doi' : ''}`}>
                            {paper.doi ? 'DOI' : 'Metadata'}
                          </span>
                        </div>
                        <h4>{paperLabel(paper)}</h4>
                        <p className="rag-paper-authors">{paper.authors || paper.venue || 'No metadata returned'}</p>
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
                    <p className="rag-kicker">Corpus snapshot</p>
                    <h3>Current paper library picture</h3>
                  </div>
                  <div className="section-meta">Quick read</div>
                </div>

                <div className="rag-insight-grid">
                  <article className="card-surface subtle insight-card">
                    <span>Top match</span>
                    <strong>{searchResults.length ? `${Math.min(100, Math.round((searchResults[0]?.score || 0) * 100))}%` : 'Ready'}</strong>
                    <p>See the strongest result first so you know whether to open it.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Indexed papers</span>
                    <strong>{formatNumber(stats?.paper_count || 0)}</strong>
                    <p>How many papers are available to search and browse.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Full-text chunks</span>
                    <strong>{formatNumber(stats?.collection_count || 0)}</strong>
                    <p>How much text the retrieval layer can search through.</p>
                  </article>
                  <article className="card-surface subtle insight-card">
                    <span>Recent queries</span>
                    <strong>{recentQueries.length}</strong>
                    <p>Your last searches stay visible for quick reuse.</p>
                  </article>
                </div>

                <div className="rag-history card-surface subtle">
                  <div className="section-head tight">
                    <div>
                      <p className="rag-kicker">Recent queries</p>
                      <h3>Tap to repeat a search</h3>
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
              </div>
              {selectedMeta ? (
                <div className="selected-panel">
                  <h4>{paperLabel(selectedMeta)}</h4>
                  {selectedMeta.citation && <p className="selected-citation">{selectedMeta.citation}</p>}
                  {selectedMeta.snippet && <p className="selected-snippet">{selectedMeta.snippet}</p>}
                  {selectedLink && (
                    <div className="selected-link-row">
                      <a href={selectedLink} target="_blank" rel="noreferrer" className="rag-link-button primary">
                        {selectedMeta.doi ? 'View on DOI.org' : 'Open source'}
                      </a>
                    </div>
                  )}
                  <div className="selected-meta">
                    {selectedMeta.score !== undefined && (
                      <div className="meta-item">
                        <span>Match score</span>
                        <strong>{typeof selectedMeta.score === 'number' ? selectedMeta.score.toFixed(2) : '—'}</strong>
                      </div>
                    )}
                    {selectedMeta.year && (
                      <div className="meta-item">
                        <span>Year</span>
                        <strong>{selectedMeta.year}</strong>
                      </div>
                    )}
                    {selectedMeta.authors && (
                      <div className="meta-item">
                        <span>Authors</span>
                        <strong>{selectedMeta.authors}</strong>
                      </div>
                    )}
                    {selectedMeta.display_title && !selectedMeta.citation && (
                      <div className="meta-item">
                        <span>Title</span>
                        <strong>{selectedMeta.display_title}</strong>
                      </div>
                    )}
                    {selectedMeta.doi && (
                      <div className="meta-item doi-item">
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
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
