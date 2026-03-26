import { useState, useEffect } from 'react'
import axios from 'axios'

// API Configuration
const API_BASE = 'https://orebit.id/api/rag' // Will update after Vercel deploy
const API_KEY = import.meta.env.VITE_RAG_API_KEY || ''

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [stats, setStats] = useState(null)
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('search') // 'search' | 'browse'

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [])

  // Fetch stats from API
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/stats`, {
        headers: { 'X-API-Key': API_KEY }
      })
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  // Search papers
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/search`, {
        query: searchQuery,
        top_k: 10
      }, {
        headers: { 'X-API-Key': API_KEY }
      })
      setSearchResults(response.data.results || [])
      setActiveTab('search')
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Browse papers
  const fetchPapers = async (page = 1) => {
    setLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/browse`, {
        params: { page, limit: 20 },
        headers: { 'X-API-Key': API_KEY }
      })
      setPapers(response.data.papers || [])
      setActiveTab('browse')
    } catch (error) {
      console.error('Browse failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="container header-content">
          <div className="logo">
            <span className="logo-icon">🔍</span>
            <h1>RAG Dashboard</h1>
          </div>
          <nav className="nav">
            <button
              className={`nav-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Search
            </button>
            <button
              className={`nav-button ${activeTab === 'browse' ? 'active' : ''}`}
              onClick={() => fetchPapers()}
            >
              Browse
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          {/* Stats Section */}
          {stats && (
            <section className="stats-section">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{stats.collection_count || 0}</div>
                  <div className="stat-label">Indexed Chunks</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.paper_count || 0}</div>
                  <div className="stat-label">Active Papers</div>
                </div>
              </div>
            </section>
          )}

          {/* Search Section */}
          {activeTab === 'search' && (
            <section className="search-section">
              <form onSubmit={handleSearch} className="search-form">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search academic papers..."
                  className="search-input"
                  disabled={loading}
                />
                <button type="submit" className="search-button" disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="results-section">
                  <h2 className="results-title">Search Results</h2>
                  <div className="results-grid">
                    {searchResults.map((result, index) => (
                      <div key={index} className="result-card">
                        <div className="result-score">Score: {result.score?.toFixed(2) || 'N/A'}</div>
                        <h3 className="result-title">{result.title}</h3>
                        <p className="result-snippet">{result.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Browse Section */}
          {activeTab === 'browse' && (
            <section className="browse-section">
              <h2 className="section-title">Browse Papers</h2>
              {loading ? (
                <div className="loading">Loading papers...</div>
              ) : papers.length > 0 ? (
                <div className="papers-grid">
                  {papers.map((paper, index) => (
                    <div key={index} className="paper-card">
                      <h3 className="paper-title">{paper.title}</h3>
                      <div className="paper-meta">
                        <span className="paper-authors">{paper.authors}</span>
                        <span className="paper-year">{paper.year}</span>
                      </div>
                      {paper.doi && (
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="paper-doi"
                        >
                          DOI: {paper.doi}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No papers found</div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>© 2024 Orebit · RAG Public Dashboard</p>
        </div>
      </footer>
    </div>
  )
}

export default App
