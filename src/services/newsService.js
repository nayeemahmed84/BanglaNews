import { analyzeSentiment, getSmartCategory } from '../utils/textAnalysis';

// Multiple CORS proxies as fallback
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/'
];

const RATE_LIMIT_DELAY = 800;
const MAX_AGE_DAYS = 3;

export const DEFAULT_SOURCES = [
  {
    name: 'জাগো নিউজ ২৪',
    id: 'jago-news',
    url: 'https://www.jagonews24.com/rss/rss.xml',
    homepage: 'https://www.jagonews24.com',
    color: '#f68b1e'
  },
  {
    name: 'রাইজিংবিডি',
    id: 'risingbd',
    url: 'https://www.risingbd.com/rss/rss.xml',
    homepage: 'https://www.risingbd.com',
    color: '#dc2626'
  },
  {
    name: 'প্রথম আলো',
    id: 'prothom-alo',
    url: 'https://www.prothomalo.com/feed/',
    homepage: 'https://www.prothomalo.com',
    color: '#ed1c24'
  },
  {
    name: 'বিডিনিউজ২৪',
    id: 'bdnews24',
    url: 'https://bangla.bdnews24.com/feed',
    homepage: 'https://bangla.bdnews24.com',
    color: '#be1e2d'
  },
  {
    name: 'সময় টিভি',
    id: 'somoy-tv',
    url: 'https://www.somoynews.tv/feed',
    homepage: 'https://www.somoynews.tv',
    color: '#1e40af'
  },
  {
    name: 'এনটিভি',
    id: 'ntv',
    url: 'https://www.ntvbd.com/feed',
    homepage: 'https://www.ntvbd.com',
    color: '#059669'
  },
  {
    name: 'চ্যানেল আই',
    id: 'channel-i',
    url: 'https://www.channelionline.com/feed',
    homepage: 'https://www.channelionline.com',
    color: '#7c3aed'
  },
  {
    name: 'ডেইলি স্টার বাংলা',
    id: 'daily-star',
    url: 'https://www.thedailystar.net/bangla/feed',
    homepage: 'https://www.thedailystar.net/bangla',
    color: '#0891b2'
  },
  {
    name: 'বিবিসি বাংলা',
    id: 'bbc-bangla',
    url: 'https://feeds.bbci.co.uk/bengali/rss.xml',
    homepage: 'https://www.bbc.com/bengali',
    color: '#b80000'
  }
];

// Helper to discover RSS feed from a URL
export const discoverSource = async (initialUrl) => {
  let url = initialUrl;
  if (!url.startsWith('http')) url = 'https://' + url;

  try {
    const html = await fetchWithProxy(url);
    if (!html) throw new Error('Could not access site');

    // 1. Check for RSS link tags
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rssLink = doc.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');

    let rssUrl = null;
    if (rssLink) {
      rssUrl = rssLink.getAttribute('href');
      // Fix relative URL
      if (rssUrl && !rssUrl.startsWith('http')) {
        const origin = new URL(url).origin;
        rssUrl = new URL(rssUrl, origin).href;
      }
    }

    // 2. If no tag, try common paths
    if (!rssUrl) {
      const commonPaths = ['/rss', '/feed', '/rss.xml', '/feed.xml'];
      const origin = new URL(url).origin;

      for (const path of commonPaths) {
        try {
          const testUrl = origin + path;
          const testHtml = await fetchWithProxy(testUrl);
          if (testHtml && (testHtml.includes('<rss') || testHtml.includes('<feed') || testHtml.includes('<channel'))) {
            rssUrl = testUrl;
            break;
          }
        } catch (e) { continue; }
      }
    }

    // Get site title
    let name = doc.querySelector('title')?.textContent?.split(/[|-]/)[0]?.trim() || new URL(url).hostname;

    return {
      name,
      id: new URL(url).hostname.replace(/www\.|com|org|net/g, '').replace(/\./g, '-'),
      url: rssUrl, // Might be null if no RSS found
      homepage: url,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color
    };

  } catch (e) {
    throw new Error('Failed to analyze site: ' + e.message);
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isWithinDateRange = (date) => {
  const now = new Date();
  const maxAge = new Date(now.getTime() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000));
  return date >= maxAge;
};

const BANGLA_DIGITS = { '০': 0, '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7, '৮': 8, '৯': 9 };
const BANGLA_MONTHS = {
  'জানুয়ারি': 'Jan', 'ফেব্রুয়ারি': 'Feb', 'মার্চ': 'Mar', 'এপ্রিল': 'Apr',
  'মে': 'May', 'জুন': 'Jun', 'জুলাই': 'Jul', 'আগস্ট': 'Aug',
  'সেপ্টেম্বর': 'Sep', 'অক্টোবর': 'Oct', 'নভেম্বর': 'Nov', 'ডিসেম্বর': 'Dec',
  'জানু': 'Jan', 'ফেব্রু': 'Feb', 'সেপ্টে': 'Sep', 'অক্টো': 'Oct', 'নভে': 'Nov', 'ডিসে': 'Dec'
};

const parseCustomDate = (dateStr) => {
  if (!dateStr) return null;

  try {
    let s = String(dateStr).trim();

    // 1. Replace Bangla numerals
    s = s.replace(/[০-৯]/g, m => BANGLA_DIGITS[m]);

    // 2. Replace Bangla months
    for (const [bn, en] of Object.entries(BANGLA_MONTHS)) {
      s = s.replace(new RegExp(bn, 'gi'), en);
    }

    // 3. Remove common extraneous text (time zones, 'at', etc if needed, though Date parses many)
    // Clean up "Time:" prefix often found in scrapes
    s = s.replace(/^Time:\s*/i, '').replace(/ প্রকাশিত:?/i, '').replace(/ আপডেট:?/i, '');

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  } catch (e) {
    return null;
  }
  return null;
};

const fetchWithProxy = async (url) => {
  // Try Tauri native fetch first if available
  if (window.__TAURI_INTERNALS__) {
    try {
      const { fetch } = await import('@tauri-apps/plugin-http');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });

      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.warn(`Tauri fetch failed for ${url}:`, e);
    }
  }

  // Fallback: Cycle through proxies
  for (const proxy of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const fullUrl = proxy + encodeURIComponent(url);
      const response = await window.fetch(fullUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 50) return text;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
};

// Enhanced image extraction
const extractImage = (item, rawXml) => {
  // Try enclosure first
  const enclosure = item.querySelector('enclosure[url]');
  if (enclosure) {
    const url = enclosure.getAttribute('url');
    if (url && url.match(/\.(jpg|jpeg|png|gif|webp)/i)) return url;
  }

  // Try media:content
  const mediaContent = item.querySelector('media\\:content[url]');
  if (mediaContent) {
    return mediaContent.getAttribute('url');
  }

  // Try media:thumbnail
  const mediaThumbnail = item.querySelector('media\\:thumbnail[url]');
  if (mediaThumbnail) {
    return mediaThumbnail.getAttribute('url');
  }

  // Try featured image (WordPress)
  const featuredImage = item.querySelector('post-thumbnail url, featured-image url');
  if (featuredImage) {
    return featuredImage.textContent;
  }

  // Search in description and content for img tags
  const description = item.querySelector('description')?.textContent || '';
  const content = item.querySelector('content\\:encoded, encoded')?.textContent || '';
  const allContent = description + content;

  // Try to find img in content
  const imgPatterns = [
    /<img[^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=([^\s>]+)/i,
    /src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|gif|webp)[^"']*)["']/i,
    /(https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp))/i
  ];

  for (const pattern of imgPatterns) {
    const match = allContent.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/&amp;/g, '&');
    }
  }

  // Try og:image pattern in raw XML
  const ogMatch = rawXml.match(/og:image[^>]+content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];

  return null;
};

// Enhanced content extraction
const extractContent = (item) => {
  // Try content:encoded first (usually has full content)
  let content = '';

  const contentEncoded = item.querySelector('content\\:encoded, encoded');
  if (contentEncoded?.textContent) {
    content = contentEncoded.textContent;
  }

  // Fallback to content
  if (!content) {
    const contentEl = item.querySelector('content');
    if (contentEl?.textContent) {
      content = contentEl.textContent;
    }
  }

  // Fallback to description
  if (!content) {
    const description = item.querySelector('description');
    if (description?.textContent) {
      content = description.textContent;
    }
  }

  // Fallback to summary
  if (!content) {
    const summary = item.querySelector('summary');
    if (summary?.textContent) {
      content = summary.textContent;
    }
  }

  // Clean HTML tags but preserve paragraph breaks
  content = content
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return content || 'বিস্তারিত পড়তে মূল সাইটে যান।';
};

// Categorization moved to textAnalysis.js

// Scrape homepage for headlines
const scrapeHomepage = async (source) => {
  if (!source.homepage) return [];

  console.log(`Trying homepage scraping for ${source.name}: ${source.homepage}`);

  try {
    const html = await fetchWithProxy(source.homepage);
    if (!html) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newsItems = [];
    const seenLinks = new Set();

    // Selectors for headlines (using descendant selector instead of direct child for flexibility)
    const selectors = [
      'h1 a', 'h2 a', 'h3 a', 'h4 a', 'h5 a', 'h6 a',
      '.news-title a', '.card-title a', '.title a',
      '.lead-news a', '.top-news a', '.post-title a',
      '.article-title a', '.entry-title a', '.headline a',
      '.news-item a', '.story-title a', '.heading a'
    ];

    // Collect all potential links
    let elements = Array.from(doc.querySelectorAll(selectors.join(',')));

    // Fallback: If no items found with selectors, try finding ANY link with substantial text
    if (elements.length === 0) {
      console.log('Using fallback scraper strategy for', source.name);
      const allLinks = Array.from(doc.querySelectorAll('body a'));
      elements = allLinks.filter(el => {
        const text = el.textContent.trim();
        const href = el.getAttribute('href');
        // Filter out short text, nav links, etc.
        return text.length > 20 && href && !href.includes('javascript:') && !href.includes('#');
      });
    }

    elements.forEach(el => {
      // Basic validation
      const title = el.textContent.trim();
      let link = el.getAttribute('href');

      // Stricter title length check for fallback
      if (!title || title.length < 15 || !link) return;

      // Fix relative links
      if (link.startsWith('/')) {
        const origin = new URL(source.homepage).origin;
        link = origin + link;
      } else if (!link.startsWith('http')) {
        return; // Ignore weird links
      }

      if (seenLinks.has(link)) return;

      // Heuristic: URL should usually contain more than just domain (e.g. /article/...)
      // But some sites have query params. Just skip root paths.
      try {
        const linkUrl = new URL(link);
        if (linkUrl.pathname === '/' || linkUrl.pathname.length < 2) return;
      } catch (e) { }

      seenLinks.add(link);

      // Find image nearby (check parent/grandparent/siblings)
      let image = null;
      // Look up to 3 parents
      let parent = el.closest('div, article, li, p');
      if (!parent) parent = el.parentElement;

      if (parent) {
        // Try to find an image in the same card
        const img = parent.querySelector('img');
        if (img) {
          image = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
        } else {
          // Try previous sibling (common in lists: img then text)
          const prev = parent.previousElementSibling;
          if (prev && prev.querySelector('img')) {
            const prevImg = prev.querySelector('img');
            image = prevImg.getAttribute('src') || prevImg.getAttribute('data-src');
          }
        }
      }

      // Fix relative image URLs
      if (image && image.startsWith('/')) {
        if (image.startsWith('//')) {
          image = 'https:' + image;
        } else {
          image = new URL(source.homepage).origin + image;
        }
      }

      const snippet = parent ? (parent.textContent || '').trim().slice(0, 250) : title;

      // Try to find a date
      let pubDate = new Date();
      let extractedDate = null;

      if (parent) {
        // Look for time element
        const timeEl = parent.querySelector('time');
        if (timeEl) {
          const dtResult = timeEl.getAttribute('datetime') || timeEl.textContent;
          extractedDate = parseCustomDate(dtResult);
        }

        // Fallback: look for common date classes
        if (!extractedDate) {
          const dateEl = parent.querySelector('.time, .date, .meta-time, .post-date, .published');
          if (dateEl) extractedDate = parseCustomDate(dateEl.textContent);
        }
      }

      if (extractedDate) {
        pubDate = extractedDate;
      } else if (newsItems.length > 0) {
        // If no date found, stagger slightly backwards so they don't all look identical
        pubDate = new Date(Date.now() - (newsItems.length * 1000));
      }

      newsItems.push({
        id: link,
        title: title,
        link: link,
        pubDate: pubDate,
        content: 'বিস্তারিত দেখতে ক্লিক করুন...',
        shortContent: 'বিস্তারিত দেখতে ক্লিক করুন...',
        image: image,
        source: source.name,
        sourceId: source.id,
        sourceColor: source.color,
        category: getSmartCategory(title + ' ' + snippet),
        sentiment: analyzeSentiment(title + ' ' + snippet)
      });
    });

    // Limit to top 15 items
    console.log(`✓ Scraped homepage for ${source.name}: ${Math.min(newsItems.length, 15)} items`);
    return newsItems.slice(0, 15);

  } catch (err) {
    console.warn(`Homepage scrape failed for ${source.name}:`, err);
    return [];
  }
};

const fetchFromRSS = async (source, options = {}) => {
  try {
    const text = await fetchWithProxy(source.url);

    if (!text || (!text.includes('<item') && !text.includes('<entry'))) {
      console.warn(`✗ ${source.name}: RSS invalid/empty`);
      return [];
    }

    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');

    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      console.warn(`✗ ${source.name}: XML parse error`);
      return [];
    }

    let items = xml.querySelectorAll('item');
    if (items.length === 0) items = xml.querySelectorAll('entry');

    if (items.length === 0) {
      console.warn(`✗ ${source.name}: No RSS items`);
      return [];
    }

    const newsItems = [];

    items.forEach((item) => {
      const title = (item.querySelector('title')?.textContent || '').trim();
      if (!title) return;

      let link = item.querySelector('link')?.textContent?.trim() || '';
      if (!link) {
        const linkEl = item.querySelector('link[href]');
        if (linkEl) link = linkEl.getAttribute('href');
      }

      const pubDateStr = item.querySelector('pubDate, published, updated')?.textContent || '';

      let pubDate = parseCustomDate(pubDateStr);
      if (!pubDate) {
        pubDate = new Date(pubDateStr);
        if (isNaN(pubDate.getTime())) pubDate = new Date();
      }

      // Skip old items unless allowOld option is set (used for search)
      if (!options.allowOld && !isWithinDateRange(pubDate)) return;

      // Use enhanced extraction
      const image = extractImage(item, text);
      const content = extractContent(item);

      newsItems.push({
        id: link || Math.random().toString(36),
        title,
        link,
        pubDate,
        content,
        shortContent: content.substring(0, 150) + '...',
        image,
        source: source.name,
        sourceId: source.id,
        sourceColor: source.color,
        category: getSmartCategory(title + " " + content),
        sentiment: analyzeSentiment(title + " " + content)
      });
    });

    console.log(`✓ ${source.name}: ${newsItems.length} news (RSS)`);
    return newsItems;
  } catch (error) {
    console.warn(`✗ ${source.name}: RSS failed (${error.message})`);
    return [];
  }
};

const fetchSource = async (source) => {
  console.log(`Fetching ${source.name} from RSS and Homepage...`);

  // Parallel fetch
  const results = await Promise.allSettled([
    fetchFromRSS(source),
    scrapeHomepage(source)
  ]);

  const rssItems = results[0].status === 'fulfilled' ? results[0].value : [];
  const homeItems = results[1].status === 'fulfilled' ? results[1].value : [];

  // Merge and deduplicate
  const allItems = [...homeItems, ...rssItems];
  const uniqueItems = [];
  const seenLinks = new Set();

  for (const item of allItems) {
    // Normalize link for checking (remove query params, trailing slash)
    try {
      const url = new URL(item.link);
      const cleanLink = url.origin + url.pathname;

      if (!seenLinks.has(cleanLink)) {
        seenLinks.add(cleanLink);
        uniqueItems.push(item);
      }
    } catch {
      // If URL parsing fails, fallback to strict link check
      if (!seenLinks.has(item.link)) {
        seenLinks.add(item.link);
        uniqueItems.push(item);
      }
    }
  }

  console.log(`✓ ${source.name}: Total ${uniqueItems.length} unique items (Merged)`);
  return uniqueItems;
};

export const fetchNews = async (customSources = null, onProgress = null) => {
  const sourcesToFetch = customSources || DEFAULT_SOURCES;
  console.log(`🔄 Fetching news from ${sourcesToFetch.length} sources...`);
  const allNews = [];

  let completed = 0;
  for (const source of sourcesToFetch) {
    const items = await fetchSource(source);
    allNews.push(...items);
    completed++;
    if (onProgress) {
      onProgress(completed, sourcesToFetch.length);
    }
    await delay(RATE_LIMIT_DELAY);
  }

  console.log(`📰 Total news fetched: ${allNews.length}`);
  return allNews.sort((a, b) => b.pubDate - a.pubDate);
};

// Search across all sources (no date limit) and return items matching `query` in title or content
export const searchAllSources = async (query, customSources = null) => {
  if (!query || String(query).trim().length === 0) return [];
  const q = String(query).toLowerCase().trim();
  const sourcesToFetch = customSources || DEFAULT_SOURCES;

  const allNews = [];

  for (const source of sourcesToFetch) {
    try {
      // Fetch RSS with allowOld=true so older items are included
      const rssItems = await fetchFromRSS(source, { allowOld: true });
      const rssCount = Array.isArray(rssItems) ? rssItems.length : 0;
      allNews.push(...(rssItems || []));
      // Also include homepage-scraped items (they may contain headlines not in RSS)
      let homeCount = 0;
      try {
        const homeItems = await scrapeHomepage(source);
        homeCount = Array.isArray(homeItems) ? homeItems.length : 0;
        allNews.push(...(homeItems || []));
      } catch (e) {
        console.debug('[searchAllSources] homepage scrape failed for', source.id, e?.message || e);
      }
      console.debug(`[searchAllSources] fetched ${rssCount} rss + ${homeCount} home items for`, source.id);
    } catch (e) {
      console.warn('Search fetch failed for', source.name, e);
    }
    await delay(RATE_LIMIT_DELAY);
  }

  // Filter by query in title or content
  const filtered = allNews.filter(item => {
    try {
      const text = ((item.title || '') + ' ' + (item.content || '') + ' ' + (item.shortContent || '')).toLowerCase();
      return text.includes(q);
    } catch {
      return false;
    }
  });

  // Deduplicate by link
  const seen = new Set();
  const unique = [];
  for (const it of filtered) {
    const key = it.link || it.id;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(it);
    }
  }

  console.debug('[searchAllSources] total fetched', allNews.length, 'matched', unique.length, 'for query', q);
  if (unique.length > 0) {
    console.debug('[searchAllSources] sample matches', unique.slice(0, 5).map(it => ({ title: it.title, link: it.link, source: it.source })));
  } else {
    try {
      const sample = allNews.slice(0, 10).map(it => ({ title: it.title, link: it.link, source: it.source, contentSnippet: (it.shortContent || '').slice(0, 120) }));
      console.debug('[searchAllSources] NO MATCH - sample fetched items (first 10):', sample);
      const inLinks = allNews.filter(it => (it.link || '').toLowerCase().includes(q)).slice(0, 5).map(it => ({ link: it.link, title: it.title }));
      const inSourceNames = allNews.filter(it => (it.source || '').toLowerCase().includes(q)).slice(0, 5).map(it => it.source);
      console.debug('[searchAllSources] query found in links (sample):', inLinks);
      console.debug('[searchAllSources] query found in source names (sample):', inSourceNames);
    } catch (e) { }
  }

  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return unique;
};
