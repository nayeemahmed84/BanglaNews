import React, { useState } from 'react';
import NewsCard from './NewsCard';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import './StoryCluster.css';

const StoryCluster = ({ cluster, isRead, isBookmarked, onToggleBookmark, onArticleClick }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const { primary, related, count, sources } = cluster;

    return (
        <div className={`story-cluster ${isExpanded ? 'expanded' : ''}`}>
            <div className="cluster-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="cluster-badge">
                    <Layers size={14} />
                    <span>{primary.source} এবং আরও {count - 1}টি উৎস</span>
                </div>
                <div className="cluster-sources">
                    অন্যান্য: {sources.filter(s => s !== primary.source).join(', ')}
                </div>
                <button className="expand-btn">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>

            <div className="primary-article">
                <NewsCard
                    news={primary}
                    isRead={isRead}
                    isBookmarked={isBookmarked}
                    onToggleBookmark={onToggleBookmark}
                    onClick={() => onArticleClick(primary)}
                />
            </div>

            {isExpanded && (
                <div className="related-articles fade-in">
                    {related.map((item, idx) => (
                        <div
                            key={item.id + '-' + idx}
                            className="related-item"
                            onClick={() => onArticleClick(item)}
                        >
                            <div className="related-meta">
                                <span className="related-source" style={{ color: item.sourceColor }}>
                                    {item.source}
                                </span>
                                <span className="related-dot">•</span>
                                <span className="related-time">{new Date(item.pubDate).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <h4 className="related-title">{item.title}</h4>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoryCluster;
