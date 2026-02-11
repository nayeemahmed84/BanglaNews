import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import NewsCard from './components/NewsCard';
import NewsModal from './components/NewsModal';
import Settings from './components/Settings';
import TrendingBar from './components/TrendingBar';
import StatsModal from './components/StatsModal';
import TopicManager from './components/TopicManager';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { fetchNews, searchAllSources, DEFAULT_SOURCES } from './services/newsService';
import ProgressBar from './components/ProgressBar';
import { scrapeImagesForArticles } from './services/imageScraper';
import { getOfflineArticles } from './services/offlineStorage';
import { clusterArticles } from './utils/storyClustering';
import StoryCluster from './components/StoryCluster';
import DailyDigest from './components/DailyDigest';
import { getTrendingTopics } from './utils/textAnalysis';
import NewsTicker from './components/NewsTicker';
import { RefreshCw, LayoutGrid, Wifi, WifiOff, Loader, Image, ChevronUp, Layers, BookOpen } from 'lucide-react';
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
  showSourceReliability: true,
  enableClustering: true,
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
  const [showDigest, setShowDigest] = useState(false);

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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastVisitTime, setLastVisitTime] = useState(() => {
    const saved = localStorage.getItem('last_visit_time');
    return saved ? parseInt(saved, 10) : Date.now();
  });
  const [offlineNews, setOfflineNews] = useState([]);

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

  const logReadActivity = useCallback((id) => {
    try {
      const savedLog = localStorage.getItem('read_activity_log');
      const log = savedLog ? JSON.parse(savedLog) : {};
      const today = new Date().toISOString().split('T')[0];

      if (!log[today]) log[today] = [];
      if (!log[today].includes(id)) {
        log[today].push(id);
        localStorage.setItem('read_activity_log', JSON.stringify(log));
      }
    } catch (e) { console.error('Failed to log activity', e); }
  }, []);

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
          let isUpdated = false;
          let revisions = existing?.revisions || [];

          if (existing) {
            // Check for updates
            const contentChanged = item.content !== existing.content;
            const titleChanged = item.title !== existing.title;

            if (contentChanged || titleChanged) {
              isUpdated = true;
              // Only store a new revision if content is significantly different
              const lastRevision = revisions[revisions.length - 1];
              if (!lastRevision || lastRevision.content !== item.content) {
                revisions.push({
                  title: existing.title,
                  content: existing.content,
                  updatedAt: Date.now()
                });
              }
            }
          }

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
            isCached: !!existing,
            isUpdated,
            revisions,
            isRead: wasRead
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
    // Update last visit for next time
    localStorage.setItem('last_visit_time', Date.now().toString());
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

  // Fetch offline articles when category changes to 'Offline'
  useEffect(() => {
    if (selectedCategory === 'Offline') {
      const fetchOffline = async () => {
        const articles = await getOfflineArticles();
        setOfflineNews(articles);
      };
      fetchOffline();
    } else {
      setOfflineNews([]); // Clear offline news if not in offline category
    }
  }, [selectedCategory]);

  // Filter news when category or search changes
  useEffect(() => {
    let result = allNews;

    if (selectedCategory === 'Saved') {
      result = result.filter(item => bookmarks.has(item.id));
    } else if (selectedCategory === 'Offline') {
      result = offlineNews;
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
  }, [searchQuery, selectedCategory, allNews, bookmarks, offlineNews]);

  // Handle pagination reset on filter change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    // If user switches to Following and has no topics, prompt them
    if (selectedCategory === 'Following' && followedTopics.length === 0) {
      setShowTopicManager(true);
    }
  }, [searchQuery, selectedCategory, followedTopics.length]);

  // Cluster news if enabled
  const clusteredNews = useMemo(() => {
    let result;
    if (!settings.enableClustering || selectedCategory === 'Offline' || searchQuery) {
      result = filteredNews.map(n => ({ id: n.id, primary: n, related: [], count: 1, isCluster: false }));
    } else {
      result = clusterArticles(filteredNews);
    }

    // Inject coverage data into primary items
    return result.map(cluster => ({
      ...cluster,
      primary: {
        ...cluster.primary,
        coverageCount: cluster.count,
        isReliable: settings.showSourceReliability && (cluster.count > 2 || ['Prothom Alo', 'BBC Bangla'].includes(cluster.primary.source))
      }
    }));
  }, [filteredNews, settings.enableClustering, selectedCategory, searchQuery, settings.showSourceReliability]);

  // Paginate displayed news
  useEffect(() => {
    const start = 0;
    const end = page * settings.itemsPerPage;
    setDisplayedNews(clusteredNews.slice(start, end));
    setHasMore(end < clusteredNews.length);
  }, [clusteredNews, page, settings.itemsPerPage]);

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
      logReadActivity(newsItem.id);
    }

    setAllNews(prev => {
      const updated = prev.map(a => a.id === newsItem.id ? { ...a, isNew: false, isCached: true } : a);
      try { localStorage.setItem('news_cache', JSON.stringify(updated)); } catch { }
      return updated;
    });
  }, [logReadActivity]); // Added logReadActivity to deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in an input
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();

      // ? — show shortcuts help
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }

      // Escape — close modals
      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (selectedNews) { setSelectedNews(null); return; }
        setFocusedIndex(-1);
        return;
      }

      // If modal is open, arrow keys navigate articles
      if (selectedNews) {
        const idx = displayedNews.findIndex(n => n.id === selectedNews.id);
        if (e.key === 'ArrowLeft' && idx > 0) {
          e.preventDefault();
          const prev = displayedNews[idx - 1].primary;
          handleCardClick(prev);
        } else if (e.key === 'ArrowRight' && idx < displayedNews.length - 1) {
          e.preventDefault();
          const next = displayedNews[idx + 1].primary;
          handleCardClick(next);
        } else if (key === 'b') {
          toggleBookmark(selectedNews.id);
        }
        return;
      }

      // J — next card
      if (key === 'j') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, displayedNews.length - 1);
          // Scroll card into view
          setTimeout(() => {
            const cards = document.querySelectorAll('.news-card');
            cards[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          return next;
        });
      }

      // K — previous card
      if (key === 'k') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          setTimeout(() => {
            const cards = document.querySelectorAll('.news-card');
            cards[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          return next;
        });
      }

      // O or Enter — open focused card
      if ((key === 'o' || key === 'enter') && focusedIndex >= 0 && focusedIndex < displayedNews.length) {
        e.preventDefault();
        handleCardClick(displayedNews[focusedIndex]);
      }

      // B — bookmark focused card
      if (key === 'b' && focusedIndex >= 0 && focusedIndex < displayedNews.length) {
        toggleBookmark(displayedNews[focusedIndex].id);
      }

      // R — refresh
      if (key === 'r' && !loading) {
        e.preventDefault();
        loadNews();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNews, displayedNews, focusedIndex, showShortcuts, loading, handleCardClick, toggleBookmark, loadNews]); // Empty dependency array = stable function reference!

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
        onSearchSubmit={handleSearchSubmit}
        remoteSearching={remoteSearching}
        onClearSearch={handleClearSearch}
        onSettingsClick={() => setShowSettings(true)}
        onStatsClick={() => setShowStats(true)}
        loading={loading || backgroundRefreshing}
        error={error}
        onHomeClick={handleGoHome}
        onRefresh={() => loadNews()}
        viewMode={viewMode}
        onViewModeToggle={toggleViewMode}
      />



      <FilterBar
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onManageTopics={() => setShowTopicManager(true)}
      />

      <div className="daily-digest-trigger container">
        <button className="digest-btn" onClick={() => setShowDigest(true)}>
          <BookOpen size={18} />
          <span>আজকের বিশেষ সংস্করণ (Daily Digest)</span>
        </button>
      </div>

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
              <span className="status-chip last-updated">
                আপডেট: {lastUpdated.toLocaleTimeString('bn-BD')}
              </span>
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
            <button
              className={`refresh-btn ${loading || backgroundRefreshing || loadingImages ? 'is-loading' : ''}`}
              onClick={() => loadNews()}
              disabled={loading || backgroundRefreshing || loadingImages}
              style={{
                '--progress': `${(progress.current / (progress.total || 1)) * 100}%`
              }}
            >
              <RefreshCw size={18} className={loading || backgroundRefreshing ? 'spin' : ''} />
              {loading || backgroundRefreshing ? (
                progress.total > 0 ? `${progress.current} / ${progress.total}` : 'চেক করা হচ্ছে...'
              ) : loadingImages ? (
                'ছবি লোড হচ্ছে...'
              ) : (
                'আপডেট করুন'
              )}
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
              {displayedNews.map((item, index) => {
                const isItemOlderThanVisit = new Date(item.pubDate).getTime() < lastVisitTime;
                const prevItemOlder = index > 0 && new Date(displayedNews[index - 1].pubDate).getTime() < lastVisitTime;
                const showSeparator = index > 0 && isItemOlderThanVisit && !prevItemOlder;

                return (
                  <React.Fragment key={item.id + '-' + index}>
                    {showSeparator && (
                      <div className="new-separator">
                        <span>আগের খবর</span>
                      </div>
                    )}

                    {item.isCluster ? (
                      <StoryCluster
                        cluster={item}
                        isRead={readIds.has(item.primary.id)}
                        isBookmarked={bookmarks.has(item.primary.id)}
                        onToggleBookmark={(e) => {
                          e.stopPropagation();
                          toggleBookmark(item.primary.id);
                        }}
                        onArticleClick={handleCardClick}
                      />
                    ) : (
                      <div
                        onClick={() => { setFocusedIndex(index); handleCardClick(item.primary); }}
                        style={{ cursor: 'pointer' }}
                        className={focusedIndex === index ? 'keyboard-focus-wrapper' : ''}
                      >
                        <NewsCard
                          news={item.primary}
                          isRead={readIds.has(item.primary.id)}
                          isBookmarked={bookmarks.has(item.primary.id)}
                          isFocused={focusedIndex === index}
                          onToggleBookmark={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.primary.id);
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
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
          onPrev={() => {
            const idx = displayedNews.findIndex(n => n.id === selectedNews.id);
            if (idx > 0) handleCardClick(displayedNews[idx - 1].primary);
          }}
          onNext={() => {
            const idx = displayedNews.findIndex(n => n.id === selectedNews.id);
            if (idx < displayedNews.length - 1) handleCardClick(displayedNews[idx + 1].primary);
          }}
          hasPrev={displayedNews.findIndex(n => n.id === selectedNews.id) > 0}
          hasNext={displayedNews.findIndex(n => n.id === selectedNews.id) < displayedNews.length - 1}
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

      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
      <DailyDigest
        isOpen={showDigest}
        onClose={() => setShowDigest(false)}
        news={allNews}
        categories={['All', 'Politics', 'Sports', 'Entertainment', 'Business', 'Technology', 'General']}
      />
    </div>
  );
}

export default App;
