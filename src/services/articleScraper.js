// Article scraper service - fetches and extracts full article content from news URLs

const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://thingproxy.freeboard.io/fetch/'
];

const fetchWithProxy = async (url) => {
    for (const proxy of CORS_PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

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

// Extract article content from HTML
const extractArticleContent = (html, sourceId) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted elements
    const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.sidebar', '.advertisement', '.ad', '.social-share',
        '.related-news', '.comments', '.author-bio', 'noscript',
        '.breadcrumb', '.navigation', '.menu', 'iframe'
    ];

    unwantedSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Site-specific selectors for article content
    const contentSelectors = {
        'jago-news': ['.news-content', '.article-content', '.news-details'],
        'risingbd': ['.article-content', '.news-details', '.content-body'],
        'prothom-alo': ['.story-content', '.story-element-text', 'article'],
        'bdnews24': ['.article-content', '.print-only', '.custombody'],
        'somoy-tv': ['.news-content', '.article-body', '.content'],
        'ntv': ['.news-details', '.article-content', '.content'],
        'channel-i': ['.news-details', '.article-content'],
        'daily-star': ['.article-content', '.story-content', '.node-content']
    };

    // Generic selectors as fallback
    const genericSelectors = [
        'article',
        '[itemprop="articleBody"]',
        '.article-body',
        '.article-content',
        '.news-content',
        '.story-content',
        '.post-content',
        '.entry-content',
        '.content-body',
        '.news-details',
        '.main-content',
        'main'
    ];

    let content = '';
    let image = '';

    // Try site-specific selectors first
    const siteSelectors = contentSelectors[sourceId] || [];
    for (const selector of [...siteSelectors, ...genericSelectors]) {
        const el = doc.querySelector(selector);
        if (el && el.textContent.trim().length > 200) {
            content = el.innerHTML;
            break;
        }
    }

    // If still no content, try to find the largest text block
    if (!content) {
        const paragraphs = doc.querySelectorAll('p');
        let allText = '';
        paragraphs.forEach(p => {
            if (p.textContent.trim().length > 50) {
                allText += p.outerHTML;
            }
        });
        content = allText;
    }

    // Extract main image
    const imageSelectors = [
        'meta[property="og:image"]',
        '.featured-image img',
        '.article-image img',
        '.news-image img',
        'article img',
        '.content img'
    ];

    for (const selector of imageSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
            image = el.getAttribute('content') || el.getAttribute('src');
            if (image) break;
        }
    }

    // Clean and format content
    const cleanContent = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/[^>]*>/gi, '')
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
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

    return {
        content: cleanContent || null,
        image: image || null
    };
};

export const scrapeArticle = async (url, sourceId) => {
    try {
        console.log(`📄 Scraping article from: ${url}`);

        const html = await fetchWithProxy(url);
        if (!html) {
            console.warn('Failed to fetch article');
            return null;
        }

        const result = extractArticleContent(html, sourceId);

        if (result.content && result.content.length > 100) {
            console.log(`✓ Scraped ${result.content.length} characters`);
            return result;
        }

        console.warn('Could not extract article content');
        return null;
    } catch (error) {
        console.error('Scrape error:', error);
        return null;
    }
};
