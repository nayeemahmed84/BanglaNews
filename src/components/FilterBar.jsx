import React from 'react';
import './FilterBar.css';

const CATEGORIES = ['All', 'Saved', 'Politics', 'Sports', 'Entertainment', 'Business', 'Technology', 'General'];
const FilterBar = ({ selectedCategory, onCategoryChange }) => {
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
                </div>
            </div>
        </div>
    );
};

const translateCategory = (category) => {
    const translations = {
        'All': 'সব খবর',
        'Saved': 'সংরক্ষিত',
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
