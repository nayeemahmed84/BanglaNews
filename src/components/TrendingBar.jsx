import React from 'react';
import { TrendingUp, Tag } from 'lucide-react';
import './TrendingBar.css';

const TrendingBar = ({ topics, onTopicClick }) => {
    if (!topics || topics.length === 0) return null;

    return (
        <div className="trending-bar fade-in">
            <div className="container trending-content">
                <div className="trending-label">
                    <TrendingUp size={16} className="trending-icon" />
                    <span>আলোচিত:</span>
                </div>
                <div className="trending-tags">
                    {topics.map((topic, index) => (
                        <button
                            key={index}
                            className="trending-tag"
                            onClick={() => onTopicClick(topic)}
                        >
                            <Tag size={12} />
                            {topic}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TrendingBar;
