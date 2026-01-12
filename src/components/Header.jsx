import React, { useState, useEffect } from 'react';
import { Search, Moon, Sun, Newspaper, Loader, X, Languages, Settings as SettingsIcon } from 'lucide-react';
import WeatherWidget from './WeatherWidget';
import './Header.css';

const Header = ({ onSearch, searchQuery, onSearchSubmit, remoteSearching, onClearSearch, onHomeClick, onSettingsClick }) => {
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

    const [phoneticMode, setPhoneticMode] = useState(true);
    const rawBufferRef = React.useRef('');
    const translitFnRef = React.useRef(null);

    // Try to dynamically load a robust Avro transliteration library when component mounts
    useEffect(() => {
        let mounted = true;
        const tryLoad = async () => {
            try {
                const candidates = ['avrojs', 'avro-transliteration', 'avro-phonetic'];
                for (const name of candidates) {
                    try {
                        const mod = await import(/* @vite-ignore */ name);
                        if (!mounted) return;
                        // try common export names
                        const fn = mod.default || mod.transliterate || mod.avro || mod.avroTransliterate || mod.convert;
                        if (typeof fn === 'function') {
                            translitFnRef.current = fn;
                            console.debug('[Header] loaded translit lib', name);
                            return;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            } catch (e) {
                // ignore
            }
            // Fallback: try local vendor file first, then CDN
            if (!translitFnRef.current && mounted) {
                const tryLoadScript = async (src) => {
                    return new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = src;
                        s.async = true;
                        s.onload = () => resolve(true);
                        s.onerror = (e) => reject(e);
                        document.head.appendChild(s);
                    });
                };

                try {
                    // local vendor copy (served from public/vendor)
                    const local = '/vendor/avro-lib-v1.1.4.min.js';
                    try {
                        await tryLoadScript(local);
                        if (window.OmicronLab && window.OmicronLab.Avro && window.OmicronLab.Avro.Phonetic && typeof window.OmicronLab.Avro.Phonetic.parse === 'function') {
                            translitFnRef.current = (latin) => window.OmicronLab.Avro.Phonetic.parse(latin);
                            console.debug('[Header] loaded OmicronLab Avro from local /vendor');
                            return;
                        }
                    } catch (e) {
                        // local not available; fall through to CDN
                    }

                    const cdn = 'https://cdn.jsdelivr.net/gh/torifat/jsAvroPhonetic@master/dist/avro-latest.js';
                    await tryLoadScript(cdn);
                    if (window.OmicronLab && window.OmicronLab.Avro && window.OmicronLab.Avro.Phonetic && typeof window.OmicronLab.Avro.Phonetic.parse === 'function') {
                        translitFnRef.current = (latin) => window.OmicronLab.Avro.Phonetic.parse(latin);
                        console.debug('[Header] loaded OmicronLab Avro from jsDelivr');
                        return;
                    }
                } catch (e) {
                    // failed to load vendor/CDN; leave fallback transliterator
                }
            }
        };

        tryLoad();
        return () => { mounted = false; };
    }, []);

    const handleKeyDown = (e) => {
        if (!phoneticMode) return;

        // Allow navigation, modifiers, etc.
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Backspace') {
            rawBufferRef.current = rawBufferRef.current.slice(0, -1);
            const translit = (translitFnRef.current ? tryTranslit(translitFnRef.current, rawBufferRef.current) : transliterateLatinToBangla(rawBufferRef.current));
            onSearch(translit);
            e.preventDefault();
            return;
        }

        if (e.key.length === 1) {
            // Printable character
            rawBufferRef.current += e.key;
            const translit = (translitFnRef.current ? tryTranslit(translitFnRef.current, rawBufferRef.current) : transliterateLatinToBangla(rawBufferRef.current));
            onSearch(translit);
            e.preventDefault();
            return;
        }

        if (e.key === ' ') {
            rawBufferRef.current += ' ';
            const translit = transliterateLatinToBangla(rawBufferRef.current);
            onSearch(translit);
            e.preventDefault();
            return;
        }
    };

    const handlePaste = (e) => {
        if (!phoneticMode) return;
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (text) {
            rawBufferRef.current += text;
            const translit = (translitFnRef.current ? tryTranslit(translitFnRef.current, rawBufferRef.current) : transliterateLatinToBangla(rawBufferRef.current));
            onSearch(translit);
            e.preventDefault();
        }
    };

    function tryTranslit(fn, latin) {
        try {
            // some libs expect single word or return object; try to normalize
            const out = fn(latin);
            if (typeof out === 'string') return out;
            if (out && out.output) return out.output;
            return String(out);
        } catch (e) {
            return transliterateLatinToBangla(latin);
        }
    }

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
                        onChange={(e) => {
                            if (!phoneticMode) {
                                onSearch(e.target.value);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && typeof onSearchSubmit === 'function') {
                                onSearchSubmit(e.target.value);
                            }
                            handleKeyDown(e);
                        }}
                        onPaste={handlePaste}
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => { rawBufferRef.current = ''; onSearch(''); if (typeof onClearSearch === 'function') onClearSearch(); }} title="Clear search">
                            <X size={14} />
                        </button>
                    )}
                    {/* Transliterate current Latin query to Bangla (phonetic) */}
                    <button className={`transliterate-btn ${phoneticMode ? 'active' : ''}`} onClick={() => {
                        const next = !phoneticMode;
                        setPhoneticMode(next);
                        if (!next) {
                            rawBufferRef.current = '';
                        }
                    }} title="ফোনেটিক টাইপিং চালু/বন্ধ">
                        <div className="btn-content">
                            <Languages size={18} />
                            <span className="btn-label">{phoneticMode ? 'অ→A' : 'A→A'}</span>
                        </div>
                    </button>
                    {remoteSearching && (
                        <span className="remote-searching" title="Remote search running">
                            <Loader size={14} className="spin" />
                        </span>
                    )}
                </div>

                <div className="header-actions">
                    <WeatherWidget />
                    <button
                        className="theme-toggle"
                        onClick={() => setIsDark(!isDark)}
                        aria-label="Toggle theme"
                    >
                        {isDark ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                    <button
                        className="settings-btn"
                        onClick={onSettingsClick}
                        aria-label="Settings"
                    >
                        <SettingsIcon size={24} />
                    </button>
                </div>
            </div>
        </header >
    );
};

export default Header;

// Simple rule-based transliteration (Latin -> Bangla) for quick phonetic conversions
function transliterateLatinToBangla(input) {
    if (!input) return '';
    const s = input.toLowerCase();

    const digraphs = {
        'kh': 'খ', 'gh': 'ঘ', 'ch': 'চ', 'ng': 'ং', 'sh': 'শ', 'ph': 'ফ', 'bh': 'ভ', 'th': 'থ', 'dh': 'ধ'
    };

    const cons = {
        'k': 'ক', 'g': 'গ', 'c': 'ক', 'j': 'জ', 't': 'ত', 'd': 'দ', 'n': 'ন', 'p': 'প', 'b': 'ব', 'm': 'ম', 'y': 'য', 'r': 'র', 'l': 'ল', 's': 'স', 'h': 'হ', 'f': 'ফ', 'v': 'ভ', 'z': 'জ', 'q': 'ক', 'x': 'ক্স', 'w': 'ও'
    };

    const vowelSign = { 'a': 'া', 'i': 'ি', 'u': 'ু', 'e': 'ে', 'o': 'ো' };
    const vowelIndep = { 'a': 'অ', 'i': 'ই', 'u': 'উ', 'e': 'এ', 'o': 'ও' };

    let out = '';
    for (let i = 0; i < s.length; i++) {
        // try digraphs
        const two = s.slice(i, i + 2);
        if (digraphs[two]) { out += digraphs[two]; i++; continue; }

        const ch = s[i];
        if (ch === ' ') { out += ' '; continue; }
        if (vowelIndep[ch]) {
            // if previous is consonant and we might want vowel sign, naive approach: use independent if at word start
            if (i === 0 || s[i - 1] === ' ') { out += vowelIndep[ch]; }
            else {
                // attach vowel sign to previous consonant if possible
                if (vowelSign[ch] && out.length > 0) {
                    out += vowelSign[ch];
                } else {
                    out += vowelIndep[ch];
                }
            }
            continue;
        }

        if (cons[ch]) {
            // check next char is vowel to attach sign
            const next = s[i + 1];
            if (vowelSign[next]) {
                out += cons[ch] + vowelSign[next];
                i++; // skip vowel
            } else {
                out += cons[ch];
            }
            continue;
        }

        // fallback: keep char
        out += ch;
    }

    // Basic cleanup: replace multiple spaces
    return out.replace(/\s{2,}/g, ' ').trim();
}
