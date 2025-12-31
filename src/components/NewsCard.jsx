import React from 'react';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { bn } from 'date-fns/locale';
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

const NewsCard = ({ news, isRead }) => {
    const { title, pubDate, image, source, sourceColor, category, isNew, isCached } = news;

    const classes = ["news-card", "fade-in"];
    if (isRead) classes.push('read');
    if (isCached) classes.push('cached');
    if (isNew) classes.push('fresh');

    return (
        <div className={classes.join(' ')}>
            <div className="card-image">
                {isRead && <div className="read-badge">পড়া হয়েছে</div>}
                {isNew && <div className="new-badge">নতুন</div>}
                {image ? (
                    <img src={image} alt={title} loading="lazy" />
                ) : (
                    <div className="placeholder-image">
                        <span>{source}</span>
                    </div>
                )}
                <div className="category-badge">{category}</div>
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
                </div>

                <h3 className="card-title">{title}</h3>
            </div>
        </div>
    );
};

export default NewsCard;
