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

const NewsCard = ({ news }) => {
    const { title, pubDate, image, source, sourceColor, category } = news;

    return (
        <div className="news-card fade-in">
            <div className="card-image">
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
