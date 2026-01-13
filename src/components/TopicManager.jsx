import React, { useState } from 'react';
import { X, Plus, Trash2, Tag } from 'lucide-react';
import './TopicManager.css';

const TopicManager = ({ isOpen, onClose, topics, onAddTopic, onRemoveTopic }) => {
    const [newTopic, setNewTopic] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newTopic.trim()) {
            onAddTopic(newTopic.trim());
            setNewTopic('');
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="topic-manager-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <Tag size={20} className="text-primary" />
                        টপিক ম্যানেজ করুন
                    </h2>
                    <p className="modal-subtitle">আপনার পছন্দের টপিকগুলো এখানে যোগ করুন।</p>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="topic-form-container">
                    <form onSubmit={handleSubmit} className="topic-form">
                        <input
                            type="text"
                            value={newTopic}
                            onChange={(e) => setNewTopic(e.target.value)}
                            placeholder="নতুন টপিক (যেমন: ক্রিকেট)..."
                            className="topic-input"
                            autoFocus
                        />
                        <button type="submit" className="add-btn" disabled={!newTopic.trim()}>
                            <Plus size={18} />
                            যোগ করুন
                        </button>
                    </form>
                </div>

                <div className="topics-list-container">
                    {topics.length > 0 && (
                        <h4 className="topics-heading">ফলো করা টপিকসমূহ ({topics.length})</h4>
                    )}

                    <div className="topics-list">
                        {topics.length === 0 ? (
                            <div className="no-topics">
                                <Tag size={40} strokeWidth={1} />
                                <p>কোনো টপিক যোগ করা হয়নি।</p>
                            </div>
                        ) : (
                            <div className="topics-grid">
                                {topics.map(topic => (
                                    <div key={topic} className="topic-chip">
                                        <span className="topic-name">{topic}</span>
                                        <button
                                            className="delete-topic-btn"
                                            onClick={() => onRemoveTopic(topic)}
                                            title="মুছুন"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopicManager;
