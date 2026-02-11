import React from 'react';
import './RelatedNews.css';

const RelatedNews = ({ currentNews, allNews, onArticleClick }) => {
    if (!currentNews || !allNews || allNews.length === 0) return null;

    // Find related news based on category and title keywords
    const [related, setRelated] = React.useState([]);

    React.useEffect(() => {
        if (!allNews || allNews.length === 0) return;

        // 1. Filter out current article
        const candidates = allNews.filter(item => item.id !== currentNews.id);

        // 2. Score candidates
        const scored = candidates.map(item => {
            let score = 0;

            // Category match (high weight)
            if (item.category === currentNews.category) score += 5;

            // Source match (low weight - maybe we want diversity? let's keep it small)
            if (item.sourceId === currentNews.sourceId) score += 1;

            // Title/Content keyword overlap (simple approximation)
            // Extract significant words from current title (length > 4)
            const keywords = currentNews.title.split(/\s+/).filter(w => w.length > 4);
            const itemText = (item.title + ' ' + (item.shortContent || '')).toLowerCase();

            keywords.forEach(kw => {
                if (itemText.includes(kw.toLowerCase())) score += 3;
            });

            return { item, score };
        });

        // 3. Sort by score and take top 4
        scored.sort((a, b) => b.score - a.score);
        const picks = scored.slice(0, 4).map(s => s.item);

        setRelated(picks);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentNews.id]);

    if (related.length === 0) return null;

    return (
        <div className="related-news-section">
            <h3 className="related-title">আরও পড়ুন</h3>
            <div className="related-grid">
                {related.map(item => (
                    <div
                        key={item.id}
                        className="related-card"
                        onClick={() => onArticleClick(item)}
                    >
                        <div className="related-image">
                            <img
                                src={item.image || '/placeholder-news.jpg'}
                                alt={item.title}
                                loading="lazy"
                                onError={(e) => {
                                    if (e.target.src !== window.location.origin + '/placeholder-news.jpg') {
                                        e.target.src = '/placeholder-news.jpg';
                                    }
                                }}
                            />
                        </div>
                        <div className="related-content">
                            <span className="related-source" style={{ color: item.sourceColor }}>
                                {item.source}
                            </span>
                            <h4 className="related-headline">{item.title}</h4>
                            <span className="related-time">
                                {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};



// Custom comparator to prevent re-renders when allNews changes in background
function arePropsEqual(prevProps, nextProps) {
    return prevProps.currentNews.id === nextProps.currentNews.id;
}

export default React.memo(RelatedNews, arePropsEqual);
