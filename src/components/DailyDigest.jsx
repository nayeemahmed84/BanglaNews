import React from 'react';
import { X, Printer, Share2, BookOpen } from 'lucide-react';
import './DailyDigest.css';

const DailyDigest = ({ isOpen, onClose, news, categories }) => {
    if (!isOpen) return null;

    // Grouping news by category for the digest
    const digestData = categories.slice(1).map(cat => {
        const catNews = news.filter(item => item.category === cat).slice(0, 3);
        return { category: cat, articles: catNews };
    }).filter(group => group.articles.length > 0);

    const today = new Date().toLocaleDateString('bn-BD', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="digest-overlay">
            <button className="digest-close-btn" onClick={onClose} title="বন্ধ করুন">
                <X size={24} />
            </button>
            <div className="digest-paper">
                <div className="digest-header">
                    <div className="header-top">
                        <span className="volume">বর্ষ ১ | সংখ্যা ৪২</span>
                        <div className="masthead">বাংলা সংবাদ</div>
                        <span className="location">ঢাকা, বাংলাদেশ</span>
                    </div>
                    <div className="header-bottom">
                        <span className="date">{today}</span>
                        <div className="header-actions">
                            <button onClick={() => window.print()} title="প্রিন্ট করুন">
                                <Printer size={18} />
                                <span className="action-text">প্রিন্ট</span>
                            </button>
                            <button title="শেয়ার করুন">
                                <Share2 size={18} />
                                <span className="action-text">শেয়ার</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="digest-content">
                    {digestData.map((group, gIdx) => (
                        <div key={gIdx} className="digest-section">
                            <h2 className="section-title">{group.category}</h2>
                            <div className="section-grid">
                                {group.articles.map((article, aIdx) => (
                                    <div key={aIdx} className={`digest-article ${aIdx === 0 ? 'lead' : ''}`}>
                                        {aIdx === 0 && article.image && (
                                            <img src={article.image} alt="" className="lead-image" />
                                        )}
                                        <h3 className="article-title">{article.title}</h3>
                                        <p className="article-excerpt">
                                            {article.content?.substring(0, 150)}...
                                        </p>
                                        <div className="article-meta">
                                            <span>{article.source}</span>
                                            {article.readingTime && <span>• {article.readingTime.label}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="digest-footer">
                    <p>© ২০২৬ বাংলা সংবাদ ডিজিটাল এডিশন। সর্বস্বত্ব সংরক্ষিত।</p>
                </div>
            </div>
        </div>
    );
};

export default DailyDigest;
