import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Clock, Share2, Loader, Image } from 'lucide-react';
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

const NewsModal = ({ news, onClose }) => {
    const [fullContent, setFullContent] = useState(null);
    const [fullImage, setFullImage] = useState(null);
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
                    if (result.content && result.content.length > (content?.length || 0)) {
                        setFullContent(result.content);
                    }
                    if (result.image && !image) {
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
        if (window.__TAURI_INTERNALS__) {
            e.preventDefault();
            try {
                const { open } = await import('@tauri-apps/plugin-shell');
                await open(link);
            } catch (err) {
                console.error('Failed to open link via Tauri:', err);
                window.open(link, '_blank');
            }
        }
    };

    const displayImage = fullImage || image;
    const displayContent = fullContent || content;

    // Prepare news object with full image for ShareCard
    const newsWithImage = {
        ...news,
        image: displayImage
    };

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
                            <div className="modal-description">
                                {displayContent.split('\n\n').map((paragraph, index) => (
                                    paragraph.trim() && <p key={index}>{paragraph.trim()}</p>
                                ))}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn-photo-card" onClick={() => setShowShareCard(true)}>
                                <Image size={18} />
                                ফটো কার্ড
                            </button>
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary"
                                onClick={handleExternalLink}
                            >
                                <ExternalLink size={18} />
                                মূল সাইট
                            </a>
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
