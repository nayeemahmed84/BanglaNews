import React from 'react';
import { Clock, Bookmark, ShieldCheck, TrendingUp, Info, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
import { estimateReadingTime } from '../utils/readingTime';
import './NewsCard.css';

const formatDate = (pubDate) => {
    try {
        const date = new Date(pubDate);
        if (isNaN(date.getTime())) return 'সম্প্রতি';
        return formatDistanceToNow(date, { addSuffix: true, locale: bn });
    } catch {
        return 'সম্প্রতি';
    }
};

const NewsCard = ({ news, isRead, isBookmarked, isFocused, onToggleBookmark, onClick }) => {
    const { title, pubDate, image, source, sourceColor, category, isNew, isCached, sentiment, content } = news;
    const readTime = estimateReadingTime(content || title);

    const sentimentEmojis = {
        positive: '😊',
        neutral: '😐',
        negative: '😟'
    };

    const classes = ["news-card", "fade-in"];
    if (isRead) classes.push('read');
    if (isCached) classes.push('cached');
    if (isNew) classes.push('fresh');
    if (isFocused) classes.push('keyboard-focused');

    return (
        <div className={classes.join(' ')} onClick={onClick}>
            <div className="card-image">
                {(isRead && !isBookmarked) ? (
                    <div className="left-badge read">পড়া হয়েছে</div>
                ) : (isNew && !isRead && !isBookmarked ? (
                    <div className="left-badge new">নতুন</div>
                ) : null)}

                <button
                    className={`bookmark-btn ${isBookmarked ? 'active' : ''}`}
                    onClick={onToggleBookmark}
                    title={isBookmarked ? "বুকমার্ক সরান" : "বুকমার্ক করুন"}
                >
                    <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                </button>

                {image ? (
                    <img src={image} alt={title} loading="lazy" />
                ) : (
                    <div className="placeholder-image">
                        <span>{source}</span>
                    </div>
                )}
                <div className="card-badges">
                    <div className="category-badge">{category}</div>
                    {sentiment && (
                        <div className={`sentiment-badge ${sentiment}`} title={`Sentiment: ${sentiment}`}>
                            {sentimentEmojis[sentiment]}
                        </div>
                    )}
                </div>
            </div>

            <div className="card-content">
                <div className="card-meta">
                    <span className="source-name" style={{ color: sourceColor }}>
                        {source}
                    </span>
                    <span className="dot">•</span>
                    <span className="pub-date">
                        <Clock size={12} />
                        {formatDate(pubDate)}
                    </span>
                    {readTime.label && (
                        <>
                            <span className="dot">•</span>
                            <span className="reading-time">{readTime.label}</span>
                        </>
                    )}
                    {news.coverageCount > 1 && (
                        <>
                            <span className="dot">•</span>
                            <span className="reliability-badge top" title={`${news.coverageCount}টি উৎস হতে কাভার করা হয়েছে`}>
                                <TrendingUp size={12} />
                                টপ স্টোরি
                            </span>
                        </>
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
                </div>

                <h3 className="card-title">{title}</h3>
            </div>
        </div>
    );
};

export default NewsCard;
