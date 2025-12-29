// Image scraper service with localStorage caching

const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/'
];

const CACHE_KEY = 'bangla_news_image_cache';
const CACHE_EXPIRY_HOURS = 24; // Cache images for 24 hours

// Load cache from localStorage
const loadCache = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // Check if cache is expired
            const hoursSinceCache = (Date.now() - timestamp) / (1000 * 60 * 60);
            if (hoursSinceCache < CACHE_EXPIRY_HOURS) {
                console.log(`📦 Loaded ${Object.keys(data).length} cached images`);
                return new Map(Object.entries(data));
            }
        }
    } catch (e) {
        console.warn('Failed to load image cache:', e);
    }
    return new Map();
};

// Save cache to localStorage
const saveCache = (cache) => {
    try {
        const data = Object.fromEntries(cache);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Failed to save image cache:', e);
    }
};

// Initialize cache from localStorage
let imageCache = loadCache();

const fetchWithProxy = async (url) => {
    for (const proxy of CORS_PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(proxy + encodeURIComponent(url), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            continue;
        }
    }
    return null;
};

// Extract main image from article HTML
const extractImageFromHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const imageSelectors = [
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
        'meta[itemprop="image"]',
        '.featured-image img',
        '.post-thumbnail img',
        '.article-image img',
        '.news-image img',
        '.entry-thumb img',
        'article img',
        '.article-content img',
        '.news-content img',
        '.story-content img',
        'main img',
        '.content img'
    ];

    for (const selector of imageSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
            let imageUrl = el.getAttribute('content') || el.getAttribute('src') || el.getAttribute('data-src');

            if (imageUrl) {
                if (imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                }

                if (!imageUrl.includes('logo') &&
                    !imageUrl.includes('icon') &&
                    !imageUrl.includes('avatar') &&
                    !imageUrl.includes('placeholder') &&
                    !imageUrl.includes('1x1') &&
                    !imageUrl.includes('blank')) {
                    return imageUrl;
                }
            }
        }
    }

    return null;
};

export const scrapeImage = async (url) => {
    // Check cache first
    if (imageCache.has(url)) {
        return imageCache.get(url);
    }

    try {
        const html = await fetchWithProxy(url);
        if (!html) return null;

        const image = extractImageFromHtml(html);

        // Cache the result (even if null to avoid re-fetching)
        imageCache.set(url, image);
        saveCache(imageCache); // Persist to localStorage

        return image;
    } catch (error) {
        console.warn('Image scrape failed:', error.message);
        return null;
    }
};

// Get cached image without fetching
export const getCachedImage = (url) => {
    return imageCache.get(url) || null;
};

// Batch scrape images for multiple articles
export const scrapeImagesForArticles = async (articles, onImageFound) => {
    // First, apply cached images
    let cachedCount = 0;
    articles.forEach(article => {
        if (!article.image && article.link) {
            const cachedImage = getCachedImage(article.link);
            if (cachedImage) {
                article.image = cachedImage;
                onImageFound(article.id, cachedImage);
                cachedCount++;
            }
        }
    });

    if (cachedCount > 0) {
        console.log(`📦 Applied ${cachedCount} cached images`);
    }

    // Then scrape remaining
    const articlesNeedingImages = articles.filter(a => !a.image && a.link && !imageCache.has(a.link));

    if (articlesNeedingImages.length === 0) {
        console.log('🖼️ All images loaded from cache');
        return;
    }

    console.log(`🖼️ Scraping images for ${articlesNeedingImages.length} articles...`);

    for (const article of articlesNeedingImages) {
        try {
            const image = await scrapeImage(article.link);
            if (image) {
                article.image = image;
                onImageFound(article.id, image);
                console.log(`✓ Found image for: ${article.title.substring(0, 30)}...`);
            }
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
            // Continue with next article
        }
    }

    console.log('🖼️ Image scraping complete');
};

// Clear image cache
export const clearImageCache = () => {
    imageCache.clear();
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Image cache cleared');
};
