import React, { useState, useEffect } from 'react';
import { Search, Moon, Sun, Newspaper } from 'lucide-react';
import './Header.css';

const Header = ({ onSearch, searchQuery }) => {
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
                <div className="logo-section">
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
                    />
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
