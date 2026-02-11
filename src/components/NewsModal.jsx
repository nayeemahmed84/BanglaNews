import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Share2, Loader, Image, Plus, Minus, Bookmark, ChevronLeft, ChevronRight, History, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { scrapeArticle } from '../services/articleScraper';
import { estimateReadingTime } from '../utils/readingTime';
import { saveForOffline, removeOfflineArticle, isArticleSaved } from '../services/offlineStorage';
import ShareCard from './ShareCard';
import RelatedNews from './RelatedNews';
import './NewsModal.css';

const formatDate = (pubDate) => {
    try {
        const date = new Date(pubDate);
        if (isNaN(date.getTime())) return 'সম্প্রতি';
        return formatDistanceToNow(date, { addSuffix: true, locale: bn });
    } catch {
        return 'সম্প্রতি';
    }
};

const NewsModal = ({ news, onClose, isBookmarked, onToggleBookmark, allNews = [], onArticleClick, onPrev, onNext, hasPrev, hasNext }) => {
    const [fullContent, setFullContent] = useState(null);
    const [fullContentHtml, setFullContentHtml] = useState(null);
    const [fullImage, setFullImage] = useState(null);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [fontSize, setFontSize] = useState(() => {
        try {
            const saved = localStorage.getItem('news_font_size');
            const parsed = saved ? parseInt(saved, 10) : NaN;
            return Number.isFinite(parsed) ? parsed : 16;
        } catch (e) {
            return 16;
        }
    });
    const [loading, setLoading] = useState(false);
    const [scraped, setScraped] = useState(false);
    const [showShareCard, setShowShareCard] = useState(false);
    const [savedOffline, setSavedOffline] = useState(false);
    const [showRevisions, setShowRevisions] = useState(false);

    // Check offline status on mount
    useEffect(() => {
        const checkStatus = async () => {
            if (news.id) {
                const saved = await isArticleSaved(news.id);
                setSavedOffline(saved);
            }
        };
        checkStatus();
    }, [news.id]);

    const toggleOffline = async () => {
        try {
            if (savedOffline) {
                await removeOfflineArticle(news.id);
                setSavedOffline(false);
            } else {
                setLoading(true);
                // Scrape full content if not already done, to ensure offline version is complete
                let articleToSave = { ...news };
                if (!scraped) {
                    const result = await scrapeArticle(link, sourceId);
                    if (result) {
                        articleToSave.contentHtml = result.contentHtml;
                        articleToSave.content = result.content || content;
                        articleToSave.image = result.image || image;
                    }
                }
                const saved = await saveForOffline(articleToSave);
                if (saved) setSavedOffline(true);
            }
        } catch (err) {
            console.error('Offline toggle failed:', err);
        } finally {
            setLoading(false);
        }
    };



    const { title, link, pubDate, image, source, sourceColor, category, content, sourceId, sentiment } = news;

    const sentimentEmojis = {
        positive: '😊',
        neutral: '😐',
        negative: '😟'
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);



    // Reset state when news changes
    useEffect(() => {
        setFullContent(null);
        setFullContentHtml(null);
        setFullImage(null);
        setScraped(false);
        setLoading(false);
        setShowShareCard(false);
        // scrollTo top of modal content
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) modalContent.scrollTop = 0;
    }, [link]);

    // Scrape full article on mount
    useEffect(() => {
        const loadFullArticle = async () => {
            if (!link || scraped) return;

            setLoading(true);
            try {
                const result = await scrapeArticle(link, sourceId);
                if (result) {
                    if (result.contentHtml) {
                        setFullContentHtml(result.contentHtml);
                        setFullContent(result.content || content);
                    } else if (result.content && result.content.length > (content?.length || 0)) {
                        setFullContent(result.content);
                    }

                    if (result.images && result.images.length > 0) {
                        setFullImage(result.images[0].src);
                    } else if (result.image && !image) {
                        setFullImage(result.image);
                    }
                }
            } catch (err) {
                console.error('Failed to scrape article:', err);
            } finally {
                setLoading(false);
                setScraped(true);
            }
        };

        loadFullArticle();
    }, [link, sourceId, content, image, scraped]);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title, url: link });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            navigator.clipboard.writeText(link);
            alert('লিংক কপি করা হয়েছে!');
        }
    };

    const handleExternalLink = (e) => {
        e.preventDefault();
        if (!link) return;

        const openInBrowser = () => {
            const a = document.createElement('a');
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        if (window.__TAURI_INTERNALS__) {
            import('@tauri-apps/plugin-shell').then(({ open }) => {
                return open(link);
            }).catch((err) => {
                console.error('Failed to open link via Tauri:', err);
                openInBrowser();
            });
        } else {
            openInBrowser();
        }
    };

    // Swipe handlers
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && hasNext) onNext();
        if (isRightSwipe && hasPrev) onPrev();
    };

    // Modal navigation keys
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.key === 'ArrowLeft' && hasPrev) onPrev();
            if (e.key === 'ArrowRight' && hasNext) onNext();
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [hasPrev, hasNext, onPrev, onNext]);





    const displayImage = fullImage || image;
    const displayContent = fullContent || content;

    const formatTextToParagraphs = (text) => {
        if (!text) return [];
        // If there are explicit paragraph breaks, keep them
        if (text.includes('\n\n')) return text.split('\n\n').map(p => p.trim()).filter(Boolean);

        // Normalize whitespace
        const normalized = text.replace(/\s+/g, ' ').trim();

        // Split into sentences using Bengali danda and common punctuation
        const sentences = normalized.split(/(?<=[।.!?])\s+/u).map(s => s.trim()).filter(Boolean);
        if (sentences.length === 0) return [normalized];

        // Group sentences into small paragraphs (2 sentences each)
        const perParagraph = 2;
        const paragraphs = [];
        for (let i = 0; i < sentences.length; i += perParagraph) {
            paragraphs.push(sentences.slice(i, i + perParagraph).join(' '));
        }

        // Further split overly long paragraphs by character length
        const final = [];
        paragraphs.forEach(p => {
            if (p.length > 800) {
                for (let i = 0; i < p.length; i += 500) final.push(p.slice(i, i + 500).trim());
            } else final.push(p);
        });

        return final.map(p => p.trim()).filter(Boolean);
    };

    // Prepare news object with full image for ShareCard
    const newsWithImage = {
        ...news,
        image: displayImage
    };

    const descriptionStyle = { fontSize: fontSize + 'px', lineHeight: 1.9 };
    useEffect(() => {
        try {
            localStorage.setItem('news_font_size', String(fontSize));
        } catch (e) { }
    }, [fontSize]);
    const displayContentHtml = fullContentHtml || news.contentHtml || null;

    const [sanitizedHtml, setSanitizedHtml] = useState(null);

    useEffect(() => {
        let mounted = true;
        if (!displayContentHtml) {
            setSanitizedHtml(null);
            return;
        }

        // dynamic import to avoid Vite static import resolution issues
        (async () => {
            try {
                const mod = await import('dompurify');
                const purify = mod.default || mod;
                const clean = purify.sanitize(displayContentHtml, { ADD_ATTR: ['loading', 'decoding'] });
                if (mounted) setSanitizedHtml(clean);
            } catch (e) {
                if (mounted) setSanitizedHtml(displayContentHtml);
            }
        })();

        return () => { mounted = false; };
    }, [displayContentHtml]);

    return (
        <>
            <div
                className="modal-backdrop"
                onClick={handleBackdropClick}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {hasPrev && (
                    <button className="nav-btn prev" onClick={onPrev} title="আগের খবর">
                        <ChevronLeft size={32} />
                    </button>
                )}

                {hasNext && (
                    <button className="nav-btn next" onClick={onNext} title="পরবর্তী খবর">
                        <ChevronRight size={32} />
                    </button>
                )}

                <div className="modal-content">
                    <button className="modal-close" onClick={onClose}>
                        <X size={24} />
                    </button>

                    {displayImage && (
                        <div className="modal-image">
                            <img src={displayImage} alt={title} onError={(e) => e.target.style.display = 'none'} />
                        </div>
                    )}

                    <div className="modal-body">
                        <div className="modal-meta">
                            <span className="modal-source" style={{ backgroundColor: sourceColor }}>
                                {source}
                            </span>

                            <span className="modal-category">{category}</span>
                            {sentiment && (
                                <span className={`modal-sentiment ${sentiment}`} title={`Sentiment: ${sentiment}`}>
                                    {sentimentEmojis[sentiment]}
                                </span>
                            )}
                            {news.isReliable && (
                                <>
                                    <span className="dot">•</span>
                                    <span className="reliability-badge verified" title="নির্ভরযোগ্য সূত্র">
                                        <ShieldCheck size={12} />
                                        ভেরিফাইড
                                    </span>
                                </>
                            )}
                            {news.isUpdated && (
                                <>
                                    <span className="dot">•</span>
                                    <span className="reliability-badge updated" title="সংবাদটি আপডেট করা হয়েছে">
                                        <RotateCcw size={12} />
                                        আপডেট
                                    </span>
                                </>
                            )}
                            <div className="font-controls">
                                <button className="font-btn" onClick={() => setFontSize(s => Math.max(12, s - 1))} title="ছোট টেক্সট">
                                    <Minus size={14} />
                                </button>
                                <button className="font-btn" onClick={() => setFontSize(s => Math.min(28, s + 1))} title="বড় টেক্সট">
                                    <Plus size={14} />
                                </button>
                            </div>
                            <span className="modal-date">
                                <Clock size={14} />
                                {formatDate(pubDate)}
                            </span>
                            {(() => {
                                const rt = estimateReadingTime(displayContent || content || title);
                                return rt.label ? <span className="modal-reading-time">📖 {rt.label}</span> : null;
                            })()}
                        </div>

                        <h2 className="modal-title">{title}</h2>

                        {loading ? (
                            <div className="modal-loading">
                                <Loader size={24} className="spin" />
                                <span>সম্পূর্ণ খবর লোড হচ্ছে...</span>
                            </div>
                        ) : (
                            <div className="modal-description" style={descriptionStyle}>
                                {/* Article Content */}
                                {!showRevisions ? (
                                    <div className="modal-article-body" style={{ fontSize: `${fontSize}px` }}> {/* Assuming fontFamily is defined elsewhere or removed */}
                                        {sanitizedHtml ? (
                                            <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                                        ) : displayContentHtml ? (
                                            // show raw HTML if sanitizer not ready
                                            <div dangerouslySetInnerHTML={{ __html: displayContentHtml }} />
                                        ) : (
                                            formatTextToParagraphs(displayContent).map((paragraph, index) => (
                                                paragraph && <p key={index}>{paragraph}</p>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div className="revisions-view fade-in">
                                        <h3>সংবাদের ইতিহাস</h3>
                                        {news.revisions.map((rev, i) => (
                                            <div key={i} className="revision-item">
                                                <div className="rev-header">
                                                    <span className="rev-date">{new Date(rev.updatedAt).toLocaleString('bn-BD')}</span>
                                                    <span className="rev-label">সংস্করণ #{news.revisions.length - i}</span>
                                                </div>
                                                <h4 className="rev-title">{rev.title}</h4>
                                                <div className="rev-body" dangerouslySetInnerHTML={{ __html: rev.content }} />
                                            </div>
                                        ))}
                                        <div className="revision-item current">
                                            <div className="rev-header">
                                                <span className="rev-date">বর্তমান সংস্করণ</span>
                                            </div>
                                            <h4 className="rev-title">{news.title}</h4>
                                            <div className="rev-body" dangerouslySetInnerHTML={{ __html: fullContentHtml || news.content }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className={`btn-secondary ${isBookmarked ? 'active-bookmark' : ''}`}
                                onClick={onToggleBookmark}
                                title={isBookmarked ? "বুকমার্ক সরান" : "বুকমার্ক করুন"}
                            >
                                <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                                {isBookmarked ? 'সংরক্ষিত' : 'সংরক্ষণ'}
                            </button>

                            {news.revisions?.length > 0 && (
                                <button
                                    className={`action-btn ${showRevisions ? 'active' : ''}`}
                                    onClick={() => setShowRevisions(!showRevisions)}
                                    title="পূর্ববর্তী সংস্করণগুলো দেখুন"
                                >
                                    <History size={20} />
                                    <span>পূর্বের ভার্সন ({news.revisions.length})</span>
                                </button>
                            )}

                            <button
                                className={`action-btn ${savedOffline ? 'active' : ''}`}
                                onClick={toggleOffline}
                                title={savedOffline ? "অফলাইন থেকে সরান" : "অফলাইনে সেভ করুন"}
                            >
                                <div className={`offline-icon ${savedOffline ? 'saved' : ''}`}>
                                    {savedOffline ? <WifiOff size={20} /> : <Wifi size={20} />}
                                </div>
                                <span>{savedOffline ? 'অফলাইনে আছে' : 'অফলাইন সেভ'}</span>
                            </button>

                            <button className="action-btn" onClick={() => setShowShareCard(true)}>
                                <Image size={18} />
                                ফটো কার্ড
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleExternalLink}
                            >
                                <ExternalLink size={18} />
                                মূল সাইট
                            </button>
                            <button className="btn-secondary" onClick={handleShare}>
                                <Share2 size={18} />
                                শেয়ার
                            </button>


                        </div>

                        <RelatedNews
                            currentNews={news}
                            allNews={allNews}
                            onArticleClick={onArticleClick || ((item) => console.log('Follow item:', item))}
                        />
                    </div>
                </div>
            </div>

            {showShareCard && (
                <ShareCard news={newsWithImage} onClose={() => setShowShareCard(false)} />
            )}
        </>
    );
};

export default NewsModal;
