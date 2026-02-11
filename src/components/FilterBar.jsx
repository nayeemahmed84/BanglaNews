import React from 'react';
import './FilterBar.css';

import { Settings as SettingsIcon } from 'lucide-react';

const CATEGORIES = ['All', 'Saved', 'Offline', 'Following', 'Politics', 'Sports', 'Entertainment', 'Business', 'Technology', 'General'];

const FilterBar = ({ selectedCategory, onCategoryChange, onManageTopics }) => {
    return (
        <div className="filter-bar">
            <div className="container filter-content">
                <div className="category-list">
                    {CATEGORIES.map((category) => (
                        <button
                            key={category}
                            className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => onCategoryChange(category)}
                        >
                            {translateCategory(category)}
                        </button>
                    ))}

                    {selectedCategory === 'Following' && (
                        <button
                            className="manage-topics-btn"
                            onClick={onManageTopics}
                            title="টপিক ম্যানেজ করুন"
                        >
                            <SettingsIcon size={14} />
                            ম্যানেজ
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const translateCategory = (category) => {
    const translations = {
        'All': 'সব খবর',
        'Saved': 'সংরক্ষিত',
        'Offline': 'অফলাইন',
        'Following': 'আপনার জন্য',
        'Politics': 'রাজনীতি',
        'Sports': 'খেলা',
        'Entertainment': 'বিনোদন',
        'Business': 'অর্থনীতি',
        'Technology': 'প্রযুক্তি',
        'General': 'অন্যান্য'
    };
    return translations[category] || category;
};

export default FilterBar;
