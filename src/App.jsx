import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import NewsCard from './components/NewsCard';
import NewsModal from './components/NewsModal';
import Settings from './components/Settings';
import TrendingBar from './components/TrendingBar';
import StatsModal from './components/StatsModal';
import TopicManager from './components/TopicManager';
import { fetchNews, searchAllSources, DEFAULT_SOURCES } from './services/newsService';
import ProgressBar from './components/ProgressBar';
import { scrapeImagesForArticles } from './services/imageScraper';
import { getTrendingTopics } from './utils/textAnalysis';
import NewsTicker from './components/NewsTicker';
import { RefreshCw, LayoutGrid, Wifi, WifiOff, Loader, Image, ChevronUp } from 'lucide-react';
import './App.css';

const AUTO_REFRESH_INTERVAL = 300000; // 5 minutes
const ITEMS_PER_PAGE = 20;

const DEFAULT_SETTINGS = {
  sources: DEFAULT_SOURCES,
  enabledSources: DEFAULT_SOURCES.map(s => s.id),
  theme: 'light',
  fontSize: 16,
  viewDensity: 'comfortable',
  autoRefresh: true,
  refreshInterval: 300000,
  itemsPerPage: 20,
  defaultCategory: 'All',
  trackReadArticles: true,
  fontFamily: 'Inter'
};

function App() {
  // Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.sources) {
          parsed.sources = DEFAULT_SOURCES;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);

  // Followed Topics state
  const [followedTopics, setFollowedTopics] = useState(() => {
    try {
      const saved = localStorage.getItem('followed_topics');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [allNews, setAllNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState([]);
  const [displayedNews, setDisplayedNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(settings.defaultCategory);
  const [selectedNews, setSelectedNews] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [remoteResults, setRemoteResults] = useState(null);
  const [lastRemoteQuery, setLastRemoteQuery] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showScrollTop, setShowScrollTop] = useState(false);

  // View mode state (grid vs list)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('view_mode') || 'grid';
  });

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === 'grid' ? 'list' : 'grid';
      localStorage.setItem('view_mode', next);
      return next;
    });
  }, []);

  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('read_news_ids');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('bookmarked_news_ids');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  // Calculate trending topics from allNews
  const trendingTopics = useMemo(() => {
    return getTrendingTopics(allNews);
  }, [allNews]);

  const toggleBookmark = useCallback((newsId) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(newsId)) {
        newBookmarks.delete(newsId);
      } else {
        newBookmarks.add(newsId);
      }
      localStorage.setItem('bookmarked_news_ids', JSON.stringify([...newBookmarks]));
      return newBookmarks;
    });
  }, []);

  // Handle settings changes
  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings };
      localStorage.setItem('app_settings', JSON.stringify(merged));

      // Apply settings immediately
      if (newSettings.autoRefresh !== undefined) setAutoRefresh(newSettings.autoRefresh);
      if (newSettings.defaultCategory) setSelectedCategory(newSettings.defaultCategory);

      // Apply theme (check merged theme to be safe)
      if (merged.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      }

      // Apply font family
      if (merged.fontFamily) {
        document.body.style.fontFamily = merged.fontFamily;
      }

      return merged;
    });
  }, []);

  // Apply font family on mount and whenever settings change
  useEffect(() => {
    if (settings.fontFamily) {
      document.body.style.fontFamily = settings.fontFamily;
    }
  }, [settings.fontFamily]);

  const handleAddTopic = (topic) => {
    if (!followedTopics.includes(topic)) {
      const updated = [...followedTopics, topic];
      setFollowedTopics(updated);
      localStorage.setItem('followed_topics', JSON.stringify(updated));
    }
  };

  const handleRemoveTopic = (topic) => {
    const updated = followedTopics.filter(t => t !== topic);
    setFollowedTopics(updated);
    localStorage.setItem('followed_topics', JSON.stringify(updated));
  };

  const loadMoreRef = useCallback(node => {
    if (loading || loadingMore) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setLoadingMore(true);
        setTimeout(() => {
          setPage(prev => prev + 1);
          setLoadingMore(false);
        }, 300);
      }
    }, { threshold: 0.1, rootMargin: '200px' });

    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, [loading, loadingMore, hasMore]);

  // Update a single article's image
  const handleImageFound = useCallback((articleId, imageUrl) => {
    setAllNews(prev => {
      const updated = prev.map(article =>
        article.id === articleId ? { ...article, image: imageUrl } : article
      );
      localStorage.setItem('news_cache', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Scrape missing images in background
  const scrapeImages = useCallback(async (articles) => {
    const needsImages = articles.filter(a => !a.image && a.link).length;
    if (needsImages === 0) return;

    setLoadingImages(true);
    await scrapeImagesForArticles(articles, handleImageFound);
    setLoadingImages(false);
  }, [handleImageFound]);

  const loadNews = useCallback(async (showLoading = true, isAutoRefresh = false) => {
    if (showLoading) {
      try {
        const cached = localStorage.getItem('news_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Filter items older than 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const freshCache = parsed.filter(item => {
            try {
              return new Date(item.pubDate) > oneDayAgo;
            } catch {
              return false;
            }
          });

          if (freshCache.length > 0) {
            const marked = freshCache.map(item => ({ ...item, isCached: true, isNew: false }));
            marked.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            setAllNews(marked);
            setLoading(false);
            setBackgroundRefreshing(true);
          } else {
            localStorage.removeItem('news_cache');
            setLoading(true);
          }
        } else {
          setLoading(true);
        }
      } catch (e) {
        console.error('Cache error:', e);
        setLoading(true);
      }
    }

    try {
      setProgress({ current: 0, total: settings.sources.length });

      const data = await fetchNews(settings.sources, (current, total) => {
        setProgress({ current, total });
      });

      const filteredBySource = data.filter(item =>
        settings.enabledSources.includes(item.sourceId)
      );

      setAllNews(prevNews => {
        const prevMap = new Map();
        if (Array.isArray(prevNews)) {
          prevNews.forEach(item => prevMap.set(item.id, item));
        }

        const mergedData = filteredBySource.map(item => {
          const existing = prevMap.get(item.id);
          const wasRead = readIds.has(item.id);

          // During auto-refresh: keep existing isNew, mark truly new articles as new
          // During manual refresh / app load: clear isNew for existing, mark new articles based on read status
          let itemIsNew;
          if (isAutoRefresh) {
            itemIsNew = existing ? existing.isNew : true;
          } else {
            itemIsNew = existing ? (existing.isNew && !wasRead) : (!wasRead);
          }

          return {
            ...item,
            image: existing?.image || item.image,
            pubDate: existing ? existing.pubDate : item.pubDate,
            isNew: itemIsNew,
            isCached: !!existing
          };
        });

        mergedData.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        localStorage.setItem('news_cache', JSON.stringify(mergedData));

        setTimeout(() => scrapeImages(mergedData), 1000);

        return mergedData;
      });

      setError(null);
      setLastUpdated(new Date());
      setPage(1);
    } catch (err) {
      console.error('Fetch error:', err);
      if (!localStorage.getItem('news_cache')) {
        setError('খবর লোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      }
    } finally {
      if (showLoading) setLoading(false);
      setBackgroundRefreshing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [scrapeImages, readIds, settings.sources, settings.enabledSources]);

  // Initial load
  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Auto-refresh with jitter
  useEffect(() => {
    if (!autoRefresh) return;

    let timeoutId;
    const scheduleRefresh = () => {
      const jitter = Math.floor(Math.random() * 60000);
      const delay = settings.refreshInterval + jitter;

      console.log(`Next refresh scheduled in ${Math.round(delay / 1000)}s`);

      timeoutId = setTimeout(() => {
        loadNews(false, true);
        scheduleRefresh();
      }, delay);
    };
    scheduleRefresh();
    return () => clearTimeout(timeoutId);
  }, [autoRefresh, loadNews, settings.refreshInterval]);

  // Filter news when category or search changes
  useEffect(() => {
    let result = allNews;

    if (selectedCategory === 'Saved') {
      result = result.filter(item => bookmarks.has(item.id));
    } else if (selectedCategory === 'Following') {
      if (followedTopics.length > 0) {
        result = result.filter(item => {
          const text = (item.title + ' ' + (item.content || '')).toLowerCase();
          return followedTopics.some(topic => text.includes(topic.toLowerCase()));
        });
      } else {
        result = []; // No topics followed
      }
    } else if (selectedCategory !== 'All') {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery) {
      result = result.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.source.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredNews(result);
  }, [searchQuery, selectedCategory, allNews, bookmarks]);

  // Handle pagination reset on filter change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    // If user switches to Following and has no topics, prompt them
    if (selectedCategory === 'Following' && followedTopics.length === 0) {
      setShowTopicManager(true);
    }
  }, [searchQuery, selectedCategory, followedTopics.length]);

  // Paginate displayed news
  useEffect(() => {
    const endIndex = page * settings.itemsPerPage;
    const itemsToShow = filteredNews.slice(0, endIndex);
    setDisplayedNews(itemsToShow);
    setHasMore(endIndex < filteredNews.length);
  }, [filteredNews, page, settings.itemsPerPage]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setSelectedNews(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Stable ref for accessing latest state in callbacks without re-creating them
  const stateRef = React.useRef({ readIds, settings, allNews });
  useEffect(() => {
    stateRef.current = { readIds, settings, allNews };
  }, [readIds, settings, allNews]);

  const handleCardClick = useCallback((newsItem) => {
    setSelectedNews(newsItem);

    const { readIds, settings } = stateRef.current; // Access latest state via ref

    if (settings.trackReadArticles && !readIds.has(newsItem.id)) {
      const newReadIds = new Set(readIds).add(newsItem.id);
      setReadIds(newReadIds);
      localStorage.setItem('read_news_ids', JSON.stringify([...newReadIds]));
    }

    setAllNews(prev => {
      const updated = prev.map(a => a.id === newsItem.id ? { ...a, isNew: false, isCached: true } : a);
      try { localStorage.setItem('news_cache', JSON.stringify(updated)); } catch { }
      return updated;
    });
  }, []); // Empty dependency array = stable function reference!

  const handleClearSearch = useCallback(() => {
    setRemoteResults(null);
    setLastRemoteQuery('');
    setRemoteSearching(false);
    setSearchQuery('');
    setFilteredNews(allNews);
    setPage(1);
    setHasMore(allNews.length > settings.itemsPerPage);
  }, [allNews, settings.itemsPerPage]);

  const handleSearchSubmit = async (query) => {
    if (!query || String(query).trim().length === 0) return;
    setRemoteSearching(true);
    setRemoteResults(null);
    setLastRemoteQuery(query);
    try {
      const results = await searchAllSources(query, settings.sources);
      setRemoteResults(results);
      setFilteredNews(results);
      setPage(1);
      setHasMore(results.length > settings.itemsPerPage);
    } catch (e) {
      console.error('Remote search failed', e);
    } finally {
      setRemoteSearching(false);
    }
  };

  const handleGoHome = useCallback(() => {
    try {
      setRemoteResults(null);
      setLastRemoteQuery('');
      setRemoteSearching(false);
      setSearchQuery('');
      setSelectedCategory('All');
      setSelectedNews(null);
      loadNews(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.warn('handleGoHome error', e);
    }
  }, [loadNews]);

  return (
    <div className="app">
      <Header
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        onHomeClick={handleGoHome}
        remoteSearching={remoteSearching}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
        onSettingsClick={() => setShowSettings(true)}
        onStatsClick={() => setShowStats(true)}
      />

      <FilterBar
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onManageTopics={() => setShowTopicManager(true)}
      />

      <TrendingBar
        topics={trendingTopics}
        onTopicClick={(topic) => setSearchQuery(topic)}
      />

      <NewsTicker
        news={allNews}
        onNewsClick={handleCardClick}
      />

      <main className="container main-content">
        <div className="section-header">
          <div className="title-area">
            <LayoutGrid size={20} className="text-muted" />
            <h2>সর্বশেষ সংবাদ</h2>
            {lastUpdated && (
              <span className="last-updated">
                আপডেট: {lastUpdated.toLocaleTimeString('bn-BD')}
              </span>
            )}
            {loadingImages && (
              <span className="loading-images">
                <Image size={14} className="spin" />
                ছবি লোড হচ্ছে...
              </span>
            )}
            {backgroundRefreshing && (
              <span className="refresh-badge fade-in">
                <RefreshCw size={12} className="spin" />
                আপডেট চেক করা হচ্ছে...
              </span>
            )}

            {progress.total > 0 && (loading || backgroundRefreshing) && (
              <div style={{ width: '200px' }}>
                <ProgressBar
                  current={progress.current}
                  total={progress.total}
                  label="আপডেট হচ্ছে..."
                />
              </div>
            )}
          </div>
          <div className="header-actions">
            <span className="news-count">{filteredNews.length} টি খবর</span>

            <button
              className="view-mode-btn"
              onClick={toggleViewMode}
              title={viewMode === 'grid' ? "লিস্ট ভিউ" : "গ্রিড ভিউ"}
            >
              {viewMode === 'grid' ? (
                <div style={{ transform: 'rotate(90deg)' }}><LayoutGrid size={18} /></div>
              ) : (
                <LayoutGrid size={18} />
              )}
            </button>

            <button
              className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'অটো রিফ্রেশ বন্ধ করুন' : 'অটো রিফ্রেশ চালু করুন'}
            >
              {autoRefresh ? <Wifi size={18} /> : <WifiOff size={18} />}
              {autoRefresh ? 'লাইভ' : 'অফ'}
            </button>
            <button className="refresh-btn" onClick={() => loadNews()} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
              আপডেট করুন
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>খবর লোড হচ্ছে...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={() => loadNews()} className="retry-btn">আবার চেষ্টা করুন</button>
          </div>
        ) : displayedNews.length > 0 ? (
          <>
            <div className={`news-grid view-density-${settings.viewDensity} ${viewMode}-view`}>
              {displayedNews.map((item, index) => (
                <div
                  key={item.id + '-' + index}
                  onClick={() => handleCardClick(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <NewsCard
                    news={item}
                    isRead={readIds.has(item.id)}
                    isBookmarked={bookmarks.has(item.id)}
                    onToggleBookmark={(e) => {
                      e.stopPropagation();
                      toggleBookmark(item.id);
                    }}
                  />
                </div>
              ))}
            </div>

            <div ref={loadMoreRef} className="load-more-trigger">
              {loadingMore && (
                <div className="loading-more">
                  <Loader size={24} className="spin" />
                  <span>আরো খবর লোড হচ্ছে...</span>
                </div>
              )}
              {!hasMore && displayedNews.length > 0 && (
                <div className="end-of-feed">
                  <span>সব খবর দেখা হয়েছে</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="no-results">
            {selectedCategory === 'Following' && followedTopics.length === 0 ? (
              <div style={{ textAlign: 'center' }}>
                <p>আপনি এখনো কোনো টপিক ফলো করেননি।</p>
                <button className="btn-primary" onClick={() => setShowTopicManager(true)} style={{ marginTop: '10px' }}>
                  টপিক যোগ করুন
                </button>
              </div>
            ) : (
              <p>আপনার খোঁজা অনুযায়ী কোনো খবর পাওয়া যায়নি।</p>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} বাংলার খবর - সকল প্রধান পোর্টাল থেকে সংবাদ</p>
        </div>
      </footer>

      {selectedNews && (
        <NewsModal
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
          isBookmarked={bookmarks.has(selectedNews.id)}
          onToggleBookmark={() => toggleBookmark(selectedNews.id)}
          allNews={allNews}
          onArticleClick={handleCardClick}
        />
      )}

      {showSettings && (
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          currentSettings={settings}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {showStats && (
        <StatsModal
          isOpen={showStats}
          onClose={() => setShowStats(false)}
          readIds={readIds}
          allNews={allNews}
        />
      )}

      {showTopicManager && (
        <TopicManager
          isOpen={showTopicManager}
          onClose={() => setShowTopicManager(false)}
          topics={followedTopics}
          onAddTopic={handleAddTopic}
          onRemoveTopic={handleRemoveTopic}
        />
      )}

      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={scrollToTop}
          title="উপরে যান"
        >
          <ChevronUp size={24} />
        </button>
      )}
    </div>
  );
}

export default App;
