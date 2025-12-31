import React, { useState, useEffect } from 'react';
import { Search, Moon, Sun, Newspaper, Loader, X } from 'lucide-react';
import './Header.css';

const Header = ({ onSearch, searchQuery, onSearchSubmit, remoteSearching, onClearSearch, onHomeClick }) => {
    const [isDark, setIsDark] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark';
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    return (
        <header className="header">
            <div className="container header-content">
                <div
                    className="logo-section"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { if (typeof onHomeClick === 'function') onHomeClick(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && typeof onHomeClick === 'function') onHomeClick(); }}
                    role="button"
                    tabIndex={0}
                >
                    <div className="logo-icon">
                        <Newspaper size={28} />
                    </div>
                    <h1>বাংলার খবর</h1>
                </div>

                <div className="search-bar">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="খবর খুঁজুন..."
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && typeof onSearchSubmit === 'function') {
                                onSearchSubmit(e.target.value);
                            }
                        }}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => { onSearch(''); if (typeof onClearSearch === 'function') onClearSearch(); }} title="Clear search">
                            <X size={14} />
                        </button>
                    )}
                    {remoteSearching && (
                        <span className="remote-searching" title="Remote search running">
                            <Loader size={14} className="spin" />
                        </span>
                    )}
                </div>

                <button
                    className="theme-toggle"
                    onClick={() => setIsDark(!isDark)}
                    aria-label="Toggle theme"
                >
                    {isDark ? <Sun size={24} /> : <Moon size={24} />}
                </button>
            </div>
        </header>
    );
};

export default Header;
