import React from 'react';
import { Zap } from 'lucide-react';
import './NewsTicker.css';

const NewsTicker = ({ news = [], onNewsClick }) => {
    if (!news || news.length === 0) return null;

    // Filter top 10 recent news for the ticker
    const tickerNews = news.slice(0, 10);

    return (
        <div className="news-ticker-container">
            <div className="ticker-label">
                <Zap size={14} fill="currentColor" />
                <span>ব্রেকিং নিউজ</span>
            </div>
            <div className="ticker-wrapper">
                <div className="ticker-content">
                    {tickerNews.map((item, index) => (
                        <div
                            key={`ticker-${item.id}-${index}`}
                            className="ticker-item"
                            onClick={() => onNewsClick(item)}
                        >
                            <span className="ticker-source">[{item.source}]</span>
                            <span className="ticker-title">{item.title}</span>
                            <span className="ticker-separator">•</span>
                        </div>
                    ))}
                    {/* Duplicate for seamless scrolling */}
                    {tickerNews.map((item, index) => (
                        <div
                            key={`ticker-dup-${item.id}-${index}`}
                            className="ticker-item"
                            onClick={() => onNewsClick(item)}
                        >
                            <span className="ticker-source">[{item.source}]</span>
                            <span className="ticker-title">{item.title}</span>
                            <span className="ticker-separator">•</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NewsTicker;
