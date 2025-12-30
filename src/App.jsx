import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import NewsCard from './components/NewsCard';
import NewsModal from './components/NewsModal';
import { fetchNews } from './services/newsService';
import { scrapeImagesForArticles } from './services/imageScraper';
import { RefreshCw, LayoutGrid, Wifi, WifiOff, Loader, Image } from 'lucide-react';
import './App.css';

const AUTO_REFRESH_INTERVAL = 120000; // 2 minutes
const ITEMS_PER_PAGE = 20;

function App() {
  const [allNews, setAllNews] = useState([]);
  const [filteredNews, setFilteredNews] = useState([]);
  const [displayedNews, setDisplayedNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedNews, setSelectedNews] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

  const loadNews = useCallback(async (showLoading = true) => {
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
            setAllNews(freshCache);
            setLoading(false);
            setBackgroundRefreshing(true);
          } else {
            // All cached items are old
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
      const data = await fetchNews();

      setAllNews(prevNews => {
        // Merge existing images with new data to prevent flickering
        const imageMap = new Map();
        if (Array.isArray(prevNews)) {
          prevNews.forEach(item => {
            if (item.image) imageMap.set(item.id, item.image);
          });
        }

        const mergedData = data.map(item => ({
          ...item,
          image: imageMap.get(item.id) || item.image
        }));

        localStorage.setItem('news_cache', JSON.stringify(mergedData));

        // Start scraping images in background with the merged data
        setTimeout(() => scrapeImages(mergedData), 1000);

        return mergedData;
      });

      setError(null);
      setLastUpdated(new Date());
      setPage(1);
    } catch (err) {
      console.error('Fetch error:', err);
      // Only show error if we have no cached data to show
      if (!localStorage.getItem('news_cache')) {
        setError('খবর লোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      }
    } finally {
      if (showLoading) setLoading(false);
      setBackgroundRefreshing(false);
    }
  }, [scrapeImages]);

  // Initial load
  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadNews(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [autoRefresh, loadNews]);

  // Filter news when category or search changes
  useEffect(() => {
    let result = allNews;

    if (selectedCategory !== 'All') {
      result = result.filter((item) => item.category === selectedCategory);
    }

    if (searchQuery) {
      result = result.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.source.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredNews(result);
    setPage(1);
    setHasMore(true);
  }, [searchQuery, selectedCategory, allNews]);

  // Paginate displayed news
  useEffect(() => {
    const endIndex = page * ITEMS_PER_PAGE;
    const itemsToShow = filteredNews.slice(0, endIndex);
    setDisplayedNews(itemsToShow);
    setHasMore(endIndex < filteredNews.length);
  }, [filteredNews, page]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setSelectedNews(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Scroll event listener as fallback
  useEffect(() => {
    const handleScroll = () => {
      if (loading || loadingMore || !hasMore) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      if (scrollTop + clientHeight >= scrollHeight - 500) {
        setLoadingMore(true);
        setTimeout(() => {
          setPage(prev => prev + 1);
          setLoadingMore(false);
        }, 300);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore]);

  const handleCardClick = (newsItem) => {
    setSelectedNews(newsItem);
  };

  return (
    <div className="app">
      <Header onSearch={setSearchQuery} searchQuery={searchQuery} />

      <FilterBar
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
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
          </div>
          <div className="header-actions">
            <span className="news-count">{filteredNews.length} টি খবর</span>
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
            <div className="news-grid">
              {displayedNews.map((item, index) => (
                <div
                  key={item.id + '-' + index}
                  onClick={() => handleCardClick(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <NewsCard news={item} />
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
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
            <p>আপনার খোঁজা অনুযায়ী কোনো খবর পাওয়া যায়নি।</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>© {new Date().getFullYear()} বাংলার খবর - সকল প্রধান পোর্টাল থেকে সংবাদ</p>
        </div>
      </footer>

      {selectedNews && (
        <NewsModal news={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </div>
  );
}

export default App;
