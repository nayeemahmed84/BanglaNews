import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Share2, Loader, Image, Plus, Minus, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { scrapeArticle } from '../services/articleScraper';
import ShareCard from './ShareCard';
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

const NewsModal = ({ news, onClose, isBookmarked, onToggleBookmark }) => {
    const [fullContent, setFullContent] = useState(null);
    const [fullContentHtml, setFullContentHtml] = useState(null);
    const [fullImage, setFullImage] = useState(null);
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

    const { title, link, pubDate, image, source, sourceColor, category, content, sourceId } = news;

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

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

    const handleExternalLink = async (e) => {
        e.preventDefault();

        if (window.__TAURI_INTERNALS__) {
            try {
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(link);
            } catch (err) {
                console.error('Failed to open link via Tauri:', err);
                window.open(link, '_blank');
            }
        } else {
            window.open(link, '_blank');
        }
    };

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
            <div className="modal-backdrop" onClick={handleBackdropClick}>
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
                        </div>

                        <h2 className="modal-title">{title}</h2>

                        {loading ? (
                            <div className="modal-loading">
                                <Loader size={24} className="spin" />
                                <span>সম্পূর্ণ খবর লোড হচ্ছে...</span>
                            </div>
                        ) : (
                            <div className="modal-description" style={descriptionStyle}>
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

                            <button className="btn-photo-card" onClick={() => setShowShareCard(true)}>
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
