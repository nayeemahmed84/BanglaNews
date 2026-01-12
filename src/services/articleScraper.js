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
    '.jeg_breadcrumbs', // Navigation
    '.well.well-sm', // JagoNews recruitment block
    '.css-19g7urm' // BBC image credit class
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
        /[এ-য়]+\s*\/\s*[এ-য়]+/g, // JagoNews reporter/editor initials (pair like এসএনআর/এএসএম)
        /\b[এ-য়]{2,3}(?=।|\s*<|$|\s)/g, // JagoNews standalone initials (like এমআর)
        /প্রকাশ:?\s*[০-৯০-৯\-\/:\s]+/gi, // bdnews24 published timestamp
        /আপডেট:?\s*[০-৯০-৯\-\/:\s]+/gi, // bdnews24 updated timestamp
        /Published:?\s*[0-9\-\/:\s]+/gi, // bdnews24 English published
        /Updated:?\s*[0-9\-\/:\s]+/gi // bdnews24 English updated
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
            // Special handling for Prothom Alo photo stories / multi-image articles
            const galleryItems = el.querySelectorAll('figure.qt-figure');
            if (galleryItems.length > 2) {
                // It's a photo story, let's make sure we get all these blocks
                let galleryHtml = '';
                galleryItems.forEach(item => {
                    // Clean the item but keep its structure
                    const img = item.querySelector('img');
                    const caption = item.querySelector('figcaption');
                    if (img) {
                        const src = img.getAttribute('src') || img.getAttribute('data-src');
                        const capText = caption ? caption.innerHTML : '';
                        galleryHtml += `
                            <figure class="qt-figure" style="margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
                                <img src="${src}" style="width: 100%; height: auto; border-radius: 8px;" />
                                ${capText ? `<figcaption style="margin-top: 0.5rem; font-style: italic; color: #666;">${capText}</figcaption>` : ''}
                            </figure>
                        `;
                    }
                });

                // If we found a substantial gallery, use it or prepend it
                if (galleryHtml.length > 500) {
                    contentHtml = galleryHtml + el.innerHTML;
                } else {
                    contentHtml = el.innerHTML;
                }
            } else {
                contentHtml = el.innerHTML;
            }
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
        '.news-image img', 'article img', '.content img', '.post-thumbnail img',
        '.main-image img', '.hero-image img', 'figure img', '.cover-image img',
        // Common containers for background images
        '.featured-image', '.article-image', '.news-image', '.hero-image', '.cover-image'
    ];

    for (const selector of imageSelectors) {
        const el = doc.querySelector(selector);
        if (el) {
            // 1. Check for standard img attributes (including lazy loading)
            let candidate = el.getAttribute('content') ||
                el.getAttribute('data-src') ||
                el.getAttribute('data-original') ||
                el.getAttribute('data-lazy-src') ||
                el.getAttribute('data-url') ||
                el.getAttribute('src');

            // 2. Check for background-image style
            if (!candidate && el.style && el.style.backgroundImage) {
                const bgMatch = el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (bgMatch) candidate = bgMatch[1];
            }

            // 3. Check for specific bdnews24/modern patterns (picture tag)
            if (!candidate && el.tagName === 'IMG') {
                const picture = el.closest('picture');
                if (picture) {
                    const source = picture.querySelector('source[srcset]');
                    if (source) {
                        const srcset = source.getAttribute('srcset');
                        if (srcset) candidate = srcset.split(',')[0].split(' ')[0]; // best effort: first URL
                    }
                }
            }

            if (candidate) {
                image = candidate;
                break;
            }
        }
    }

    // Fallback: If no main image found, try to find ANY substantial image in the structure
    if (!image) {
        // Try looking for a picture tag anywhere in the top 30% of the document
        const firstPicture = doc.querySelector('picture');
        if (firstPicture) {
            const img = firstPicture.querySelector('img');
            if (img) {
                image = img.getAttribute('src') || img.getAttribute('data-src');
            } else {
                const source = firstPicture.querySelector('source[srcset]');
                if (source) {
                    const srcset = source.getAttribute('srcset');
                    if (srcset) image = srcset.split(',')[0].split(' ')[0];
                }
            }
        }
    }

    // Secondary Fallback: Look in extracted content
    if (!image && contentHtml) {
        const contentDoc = new DOMParser().parseFromString(contentHtml, 'text/html');
        // Find all images
        const images = contentDoc.querySelectorAll('img');
        for (const img of images) {
            const possibleImage = img.getAttribute('src') || img.getAttribute('data-src');
            if (possibleImage && possibleImage.length > 20) {
                image = possibleImage;
                break;
            }
        }
    }

    // Final Fallback: Scrape the entire body for the first "likely" main image
    // This catches cases where the image is just a raw <img> tag at the top of the body
    if (!image) {
        const allImages = Array.from(doc.querySelectorAll('body img'));
        for (const img of allImages) {
            // Skip small icons, tracking pixels, etc. based on class/id names or attributes
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (!src) continue;

            // Skip common junk images
            if (src.includes('logo') || src.includes('icon') || src.includes('avatar') || src.includes('tracker')) continue;

            // If it has width/height, check they are substantial
            const w = parseInt(img.getAttribute('width'));
            const h = parseInt(img.getAttribute('height'));
            if (w && w < 200) continue;
            if (h && h < 100) continue;

            // If we are here, it's a candidate
            image = src;
            break;
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

        // Special rule for BBC Bangla and Channel i: remove the first image/figure which is usually redundant
        const isBbcFirst = (sourceId === 'bbc-bangla' || sourceId === 'channel-i') && index === 0;

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
            const parent = img.closest('figure, .image-container, .wp-block-image, .css-1qn0xuy');

            // DON'T deduplicate if it's part of an intentional gallery (like Prothom Alo's qt-figure)
            // unless it's the very first image and we've already shown it as a lead image
            if (parent && parent.classList.contains('qt-figure') && index > 0) {
                return;
            }

            if (parent) {
                // If it's a BBC figure, it might have a credit after it
                const next = parent.nextElementSibling;
                if (next && (next.classList.contains('css-19g7urm') || next.querySelector('.css-19g7urm'))) {
                    next.remove();
                }
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
