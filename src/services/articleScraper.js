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

// Site-specific selectors for article content
const CONTENT_SELECTORS = {
    'jago-news': ['.news-content', '.article-content', '.news-details'],
    'risingbd': ['.article-content', '.news-details', '.content-body'],
    'prothom-alo': ['.story-content', '.story-element-text', 'article', '.content'],
    'bdnews24': ['.article-content', '.print-only', '.custombody'],
    'somoy-tv': ['.news-content', '.article-body', '.content'],
    'ntv': ['.news-details', '.article-content', '.content'],
    'channel-i': ['.news-details', '.article-content'],
    'daily-star': ['.article-content', '.story-content', '.node-content'],
    'bbc-bangla': ['[data-testid="main-content"]', 'article', 'main', '.bbc-news-article']
};

const JUNK_SELECTORS = [
    'script', 'style', 'nav', 'header', 'footer', 'aside',
    '.sidebar', '.advertisement', '.ad', '.social-share',
    '.related-news', '.comments', '.author-bio', 'noscript',
    '.breadcrumb', '.navigation', '.menu', 'iframe',
    '.tags', '.tags-list', '.author-info', '.date-info',
    '.print-btn', '.share-btn', '.adsbygoogle', '.google-ads',
    '.outbrain', '.taboola', '#disqus_thread', '.recs-panel',
    '.stay-connected', '.newsletter-box', '.poll-box',
    '[role="complementary"]', '.bbc-related-content',
    '.bbc-social-share', '[data-testid="social-share"]',
    '[data-testid="related-topics-list"]',
    '[aria-labelledby="most-read-heading"]',
    '[data-component="advertisement"]',
    '[data-testid="recommendations"]', // BBC recommendation block
    '[data-testid="top-stories"]', // BBC top stories block
    '[data-testid="related-content"]', // BBC related content block
    'section[aria-labelledby]', // generic recommendations section
    '.bbc-1n76fdf', // common BBC junk class
    '.bbc-11l352c', // common BBC junk class
    'h1', // Main titles (already shown in modal)
    '.bbc-1j6im9u', // BBC specific title header class
    '.code-block', // Channel i / General ad blocks
    '.jeg_ad', '.jeg_ad_section', '.ai-track', // Channel i specific ads
    '.jeg_sidebar', '.widget_media_image', // Sidebars
    '.jeg_share_top_container', '.jeg_share_bottom_container', // Social sharing
    '.jeg_post_tags', '.jeg_prevnext_post', '.jeg_related_post', // Post meta/nav
    '.jeg_autonext_container', '#jnews_audio_player', // Infinite scroll / Audio player
    '.jeg_breadcrumbs' // Navigation
];

// Clean content from common Bengali noise and specific clutter
const postProcessContent = (html, sourceId) => {
    if (!html) return '';

    // Noise patterns to remove (Bengali phrases like "Read More", "Related News", "Advertisement")
    const noisePatterns = [
        /সংশ্লিষ্ট খবর:?.*?[\n\r]/gi,
        /আরও পড়ুন:?.*?[\n\r]/gi,
        /বিজ্ঞাপন:?.*?[\n\r]/gi,
        /ভিডিওটি দেখতে এখানে ক্লিক করুন/gi,
        /Subscribe to our channel/gi,
        /©.*?All Rights Reserved/gi,
        /বিবিসি নিউজ, বাংলা/gi,
        /এই বিষয়ে আরও পড়ুন/gi,
        /এই খবরটি শেয়ার করুন/gi,
        /আমাদের ইউটিউব চ্যানেল সাবস্ক্রাইব করুন/gi,
        /কম ডেটা ব্যবহার করতে শুধু টেক্সট পড়ুন/gi,
        /Skip সর্বাধিক পঠিত and continue reading[\s\S]*?End of সর্বাধিক পঠিত/gi,
        /Skip সর্বাধিক পঠিত and continue reading/gi,
        /End of সর্বাধিক পঠিত/gi,
        /সর্বাধিক পঠিত/gi,
        /স্কিপ করুন বিবিসি বাংলার হোয়াটসঅ্যাপ চ্যানেল পড়ুন/gi,
        /বিবিসি বাংলায় আরো পড়তে পারেন:?/gi,
        /আরো পড়ুন:?/gi,
        /বিবিসি বাংলার অন্যান্য খবর:?/gi,
        /[এ-য়]+\/[এ-য়]+/g, // JagoNews reporter/editor initials (pair)
        /\s[এ-য়]{2,3}(?=।|\s|<|$)/g // JagoNews standalone initials before punctuation or tags
    ];

    let clean = html;

    // Aggressive trim for JagoNews: everything from email or recruitment prompt onwards
    if (sourceId === 'jago-news') {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
        const recruitmentRegex = /পাঠকপ্রিয় অনলাইন নিউজ পোর্টাল জাগোনিউজ২৪.কমে লিখতে পারেন আপনিও।/i;

        let trimIndex = -1;
        const emailMatch = clean.match(emailRegex);
        if (emailMatch) trimIndex = emailMatch.index;

        const recruitmentMatch = clean.match(recruitmentRegex);
        if (recruitmentMatch && (trimIndex === -1 || recruitmentMatch.index < trimIndex)) {
            trimIndex = recruitmentMatch.index;
        }

        if (trimIndex !== -1) {
            clean = clean.substring(0, trimIndex);
        }
    }

    noisePatterns.forEach(pattern => {
        clean = clean.replace(pattern, '');
    });

    return clean.trim();
};

const extractArticleContent = (html, sourceId) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove junk elements early
    JUNK_SELECTORS.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    const genericSelectors = [
        'article', '[itemprop="articleBody"]', '.article-body', '.article-content',
        '.news-content', '.story-content', '.post-content', '.entry-content',
        '.content-body', '.news-details', '.main-content', 'main'
    ];

    let contentHtml = '';
    let image = '';

    // Try site-specific selectors first
    const siteSelectors = CONTENT_SELECTORS[sourceId] || [];
    for (const selector of [...siteSelectors, ...genericSelectors]) {
        const el = doc.querySelector(selector);
        if (el && el.textContent.trim().length > 200) {
            contentHtml = el.innerHTML;
            break;
        }
    }

    // Fallback: heuristic search for largest paragraph cluster
    if (!contentHtml) {
        const paragraphs = Array.from(doc.querySelectorAll('p'))
            .filter(p => p.textContent.trim().length > 40);

        if (paragraphs.length > 0) {
            contentHtml = paragraphs.map(p => p.outerHTML).join('\n\n');
        }
    }

    // Extract main image
    const imageSelectors = [
        'meta[property="og:image"]', '.featured-image img', '.article-image img',
        '.news-image img', 'article img', '.content img'
    ];

    for (const selector of imageSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
            image = el.getAttribute('content') || el.getAttribute('src');
            if (image) break;
        }
    }

    return {
        contentHtml: postProcessContent(contentHtml, sourceId),
        content: doc.body.textContent.trim().substring(0, 500) + '...', // summary for preview
        image: image || null
    };
};

// Utility to deduplicate images between lead image and content
const deduplicateImages = (html, leadImageUrl, sourceId) => {
    if (!html) return html;

    // Quick check before parsing DOM
    if (!html.includes('<img')) return html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let modified = false;

    // Helper to get a stable signature of an image URL for comparison
    const getImageSignature = (url) => {
        if (!url) return '';
        try {
            // Remove protocol and query parameters for fuzzy matching
            return url.split('?')[0].replace(/^https?:\/\//, '').replace(/\/$/, '');
        } catch (e) {
            return url;
        }
    };

    const leadSig = getImageSignature(leadImageUrl);

    // Search for all images in the content
    const images = Array.from(doc.querySelectorAll('img'));
    images.forEach((img, index) => {
        const src = img.getAttribute('src');
        const dataSrc = img.getAttribute('data-src');
        const srcSig = getImageSignature(src);
        const dataSig = getImageSignature(dataSrc);

        // Special rule for BBC Bangla: remove the first image/figure which is usually redundant
        const isBbcFirst = sourceId === 'bbc-bangla' && index === 0;

        // Deduplicate if:
        // 1. Exact match
        // 2. Fuzzy signature match
        // 3. It's the first image and we're highly suspicious (BBC/Prothom Alo often repeat lead)
        const isMatch = isBbcFirst ||
            (leadSig && (srcSig === leadSig || dataSig === leadSig)) ||
            (src && leadImageUrl && leadImageUrl.includes(src)) ||
            (index === 0 && srcSig.length > 20 && leadSig.includes(srcSig.slice(0, 20)));

        if (isMatch) {
            // Also try to remove the parent figure/div if it's just an image wrapper
            const parent = img.closest('figure, .image-container, .wp-block-image');
            if (parent) {
                parent.remove();
            } else {
                img.remove();
            }
            modified = true;
        }
    });

    return modified ? doc.body.innerHTML : html;
};

export const scrapeArticle = async (url, sourceId) => {
    try {
        console.log(`📄 Scraping: ${url}`);
        const html = await fetchWithProxy(url);
        if (!html) return null;

        // Try Readability for high-quality extraction
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Pre-clean to help Readability
            JUNK_SELECTORS.forEach(s => doc.querySelectorAll(s).forEach(el => el.remove()));

            const { Readability } = await import('@mozilla/readability');
            if (Readability) {
                const reader = new Readability(doc);
                const parsed = reader.parse();

                if (parsed && parsed.content && parsed.content.length > 300) {
                    const leadImage = parsed.lead_image_url || null;
                    return {
                        content: (parsed.textContent || '').trim(),
                        contentHtml: deduplicateImages(postProcessContent(parsed.content, sourceId), leadImage, sourceId),
                        image: leadImage,
                        title: parsed.title,
                        byline: parsed.byline
                    };
                }
            }
        } catch (e) {
            console.warn('Readability failed, using fallback heuristics', e);
        }

        // Fallback: Custom heuristic extractor
        const result = extractArticleContent(html, sourceId);
        if (result && result.contentHtml && result.contentHtml.length > 300) {
            result.contentHtml = deduplicateImages(result.contentHtml, result.image, sourceId);
            return result;
        }

        return null;
    } catch (error) {
        console.error('Scrape error:', error);
        return null;
    }
};
