// Multiple CORS proxies as fallback
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/'
];

const RATE_LIMIT_DELAY = 800;
const MAX_AGE_DAYS = 3;

const NEWS_SOURCES = [
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
  }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isWithinDateRange = (date) => {
  const now = new Date();
  const maxAge = new Date(now.getTime() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000));
  return date >= maxAge;
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

const categorize = (text) => {
  const content = text.toLowerCase();
  if (content.match(/খেলা|ক্রিকেট|ফুটবল|মেসি|নেইমার|সাকিব|sport/i)) return 'Sports';
  if (content.match(/রাজনীতি|নির্বাচন|সরকার|বিএনপি|আওয়ামী|politic/i)) return 'Politics';
  if (content.match(/বিনোদন|চলচ্চিত্র|সিনেমা|অভিনেতা|অভিনেত্রী|entertainment/i)) return 'Entertainment';
  if (content.match(/অর্থনীতি|বাজেট|টাকা|ব্যাংক|ব্যবসা|business|economy/i)) return 'Business';
  if (content.match(/প্রযুক্তি|স্মার্টফোন|কম্পিউটার|ইন্টারনেট|tech/i)) return 'Technology';
  return 'General';
};

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

    // Selectors for headlines
    const selectors = [
      'h1 > a', 'h2 > a', 'h3 > a', 'h4 > a',
      '.news-title a', '.card-title a', '.title a',
      '.lead-news a', '.top-news a', '.post-title a'
    ];

    // Collect all potential links
    const elements = doc.querySelectorAll(selectors.join(','));

    elements.forEach(el => {
      // Basic validation
      const title = el.textContent.trim();
      let link = el.getAttribute('href');

      if (!title || title.length < 15 || !link) return;

      // Fix relative links
      if (link.startsWith('/')) {
        const origin = new URL(source.homepage).origin;
        link = origin + link;
      } else if (!link.startsWith('http')) {
        return; // Ignore weird links
      }

      if (seenLinks.has(link)) return;
      seenLinks.add(link);

      // Find image nearby (naive check parent/grandparent)
      let image = null;
      const parent = el.closest('div, article, li');
      if (parent) {
        const img = parent.querySelector('img');
        if (img) {
          image = img.getAttribute('src') || img.getAttribute('data-src');
          if (image && image.startsWith('/')) {
            if (image.startsWith('//')) {
              image = 'https:' + image;
            } else {
              image = new URL(source.homepage).origin + image;
            }
          }
        }
      }

      newsItems.push({
        id: link,
        title: title,
        link: link,
        pubDate: new Date(), // Homepage items are usually fresh
        content: 'বিস্তারিত দেখতে ক্লিক করুন...',
        shortContent: 'বিস্তারিত দেখতে ক্লিক করুন...',
        image: image,
        source: source.name,
        sourceId: source.id,
        sourceColor: source.color,
        category: categorize(title)
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

const fetchFromRSS = async (source) => {
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

      let pubDate = new Date(pubDateStr);
      if (isNaN(pubDate.getTime())) pubDate = new Date();

      if (!isWithinDateRange(pubDate)) return;

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
        category: categorize(title + " " + content)
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

export const fetchNews = async () => {
  console.log('🔄 Fetching news from all sources...');
  const allNews = [];

  for (const source of NEWS_SOURCES) {
    const items = await fetchSource(source);
    allNews.push(...items);
    await delay(RATE_LIMIT_DELAY);
  }

  console.log(`📰 Total news fetched: ${allNews.length}`);
  return allNews.sort((a, b) => b.pubDate - a.pubDate);
};
