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
    color: '#f68b1e'
  },
  {
    name: 'রাইজিংবিডি',
    id: 'risingbd',
    url: 'https://www.risingbd.com/rss/rss.xml',
    color: '#dc2626'
  },
  {
    name: 'প্রথম আলো',
    id: 'prothom-alo',
    url: 'https://www.prothomalo.com/feed/',
    color: '#ed1c24'
  },
  {
    name: 'বিডিনিউজ২৪',
    id: 'bdnews24',
    url: 'https://bangla.bdnews24.com/feed',
    color: '#be1e2d'
  },
  {
    name: 'সময় টিভি',
    id: 'somoy-tv',
    url: 'https://www.somoynews.tv/feed',
    color: '#1e40af'
  },
  {
    name: 'এনটিভি',
    id: 'ntv',
    url: 'https://www.ntvbd.com/feed',
    color: '#059669'
  },
  {
    name: 'চ্যানেল আই',
    id: 'channel-i',
    url: 'https://www.channelionline.com/feed',
    color: '#7c3aed'
  },
  {
    name: 'ডেইলি স্টার বাংলা',
    id: 'daily-star',
    url: 'https://www.thedailystar.net/bangla/feed',
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
  for (const proxy of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const fullUrl = proxy + encodeURIComponent(url);
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('<')) return text;
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

const fetchSource = async (source) => {
  try {
    const text = await fetchWithProxy(source.url);

    if (!text) {
      console.warn(`✗ ${source.name}: All proxies failed`);
      return [];
    }

    if (!text.includes('<item') && !text.includes('<entry')) {
      console.warn(`✗ ${source.name}: No items in feed`);
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
      console.warn(`✗ ${source.name}: No items found`);
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

    console.log(`✓ ${source.name}: ${newsItems.length} news`);
    return newsItems;
  } catch (error) {
    console.warn(`✗ ${source.name}: ${error.message}`);
    return [];
  }
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

const categorize = (text) => {
  const content = text.toLowerCase();
  if (content.match(/খেলা|ক্রিকেট|ফুটবল|মেসি|নেইমার|সাকিব|sport/i)) return 'Sports';
  if (content.match(/রাজনীতি|নির্বাচন|সরকার|বিএনপি|আওয়ামী|politic/i)) return 'Politics';
  if (content.match(/বিনোদন|চলচ্চিত্র|সিনেমা|অভিনেতা|অভিনেত্রী|entertainment/i)) return 'Entertainment';
  if (content.match(/অর্থনীতি|বাজেট|টাকা|ব্যাংক|ব্যবসা|business|economy/i)) return 'Business';
  if (content.match(/প্রযুক্তি|স্মার্টফোন|কম্পিউটার|ইন্টারনেট|tech/i)) return 'Technology';
  return 'General';
};
