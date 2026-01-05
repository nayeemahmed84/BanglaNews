import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Trash2, Download, Upload, AlertCircle } from 'lucide-react';
import './Settings.css';

const DEFAULT_SETTINGS = {
    enabledSources: [
        'jago-news', 'risingbd', 'prothom-alo', 'bdnews24',
        'somoy-tv', 'ntv', 'channel-i', 'daily-star', 'bbc-bangla'
    ],
    theme: 'light',
    fontSize: 16,
    viewDensity: 'comfortable',
    autoRefresh: true,
    refreshInterval: 300000,
    itemsPerPage: 20,
    defaultCategory: 'All',
    trackReadArticles: true,
    cacheEnabled: true,
    imagePreloading: true
};

const NEWS_SOURCES = [
    { name: 'জাগো নিউজ ২৪', id: 'jago-news', color: '#f68b1e' },
    { name: 'রাইজিংবিডি', id: 'risingbd', color: '#dc2626' },
    { name: 'প্রথম আলো', id: 'prothom-alo', color: '#ed1c24' },
    { name: 'বিডিনিউজ২৪', id: 'bdnews24', color: '#be1e2d' },
    { name: 'সময় টিভি', id: 'somoy-tv', color: '#1e40af' },
    { name: 'এনটিভি', id: 'ntv', color: '#059669' },
    { name: 'চ্যানেল আই', id: 'channel-i', color: '#7c3aed' },
    { name: 'ডেইলি স্টার বাংলা', id: 'daily-star', color: '#0891b2' },
    { name: 'বিবিসি বাংলা', id: 'bbc-bangla', color: '#b80000' }
];

const Settings = ({ isOpen, onClose, currentSettings, onSettingsChange }) => {
    const [activeTab, setActiveTab] = useState('sources');
    const [settings, setSettings] = useState(currentSettings || DEFAULT_SETTINGS);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    useEffect(() => {
        if (currentSettings) {
            setSettings(currentSettings);
        }
    }, [currentSettings]);

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (onSettingsChange) {
            onSettingsChange(newSettings);
        }
    };

    const toggleSource = (sourceId) => {
        const enabledSources = settings.enabledSources.includes(sourceId)
            ? settings.enabledSources.filter(id => id !== sourceId)
            : [...settings.enabledSources, sourceId];
        updateSetting('enabledSources', enabledSources);
    };

    const selectAllSources = () => {
        updateSetting('enabledSources', NEWS_SOURCES.map(s => s.id));
    };

    const deselectAllSources = () => {
        updateSetting('enabledSources', []);
    };

    const handleClearCache = () => {
        localStorage.removeItem('news_cache');
        alert('ক্যাশ সফলভাবে মুছে ফেলা হয়েছে');
    };

    const handleClearHistory = () => {
        localStorage.removeItem('read_news_ids');
        alert('পঠিত ইতিহাস সফলভাবে মুছে ফেলা হয়েছে');
    };

    const handleExportSettings = () => {
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'banglanews-settings.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportSettings = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                setSettings(imported);
                if (onSettingsChange) {
                    onSettingsChange(imported);
                }
                alert('সেটিংস সফলভাবে আমদানি করা হয়েছে');
            } catch (err) {
                alert('সেটিংস আমদানি করতে ব্যর্থ হয়েছে');
            }
        };
        reader.readAsText(file);
    };

    const handleResetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        if (onSettingsChange) {
            onSettingsChange(DEFAULT_SETTINGS);
        }
        setShowResetConfirm(false);
        alert('সেটিংস রিসেট করা হয়েছে');
    };

    if (!isOpen) return null;

    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>সেটিংস</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sources')}
                    >
                        সংবাদ উৎস
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        চেহারা
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'behavior' ? 'active' : ''}`}
                        onClick={() => setActiveTab('behavior')}
                    >
                        আচরণ
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
                        onClick={() => setActiveTab('data')}
                    >
                        ডেটা
                    </button>
                </div>

                <div className="settings-content">
                    {activeTab === 'sources' && (
                        <div className="settings-section">
                            <div className="section-header">
                                <h3>সংবাদ উৎস নির্বাচন করুন</h3>
                                <div className="source-actions">
                                    <button className="text-btn" onClick={selectAllSources}>সব নির্বাচন করুন</button>
                                    <button className="text-btn" onClick={deselectAllSources}>সব বাতিল করুন</button>
                                </div>
                            </div>
                            <div className="sources-grid">
                                {NEWS_SOURCES.map(source => (
                                    <label key={source.id} className="source-item">
                                        <input
                                            type="checkbox"
                                            checked={settings.enabledSources.includes(source.id)}
                                            onChange={() => toggleSource(source.id)}
                                        />
                                        <span className="source-indicator" style={{ backgroundColor: source.color }}></span>
                                        <span className="source-name">{source.name}</span>
                                        {settings.enabledSources.includes(source.id) && (
                                            <Check size={16} className="check-icon" />
                                        )}
                                    </label>
                                ))}
                            </div>
                            {settings.enabledSources.length === 0 && (
                                <div className="warning-box">
                                    <AlertCircle size={18} />
                                    <span>অন্তত একটি সংবাদ উৎস নির্বাচন করুন</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings-section">
                            <div className="setting-item">
                                <label>থিম</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name="theme"
                                            checked={settings.theme === 'light'}
                                            onChange={() => updateSetting('theme', 'light')}
                                        />
                                        <span>হালকা</span>
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="theme"
                                            checked={settings.theme === 'dark'}
                                            onChange={() => updateSetting('theme', 'dark')}
                                        />
                                        <span>অন্ধকার</span>
                                    </label>
                                </div>
                            </div>

                            <div className="setting-item">
                                <label>ফন্ট সাইজ: {settings.fontSize}px</label>
                                <input
                                    type="range"
                                    min="14"
                                    max="22"
                                    value={settings.fontSize}
                                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                                    className="slider"
                                />
                            </div>

                            <div className="setting-item">
                                <label>ভিউ ডেনসিটি</label>
                                <div className="radio-group">
                                    <label>
                                        <input
                                            type="radio"
                                            name="density"
                                            checked={settings.viewDensity === 'compact'}
                                            onChange={() => updateSetting('viewDensity', 'compact')}
                                        />
                                        <span>কমপ্যাক্ট</span>
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="density"
                                            checked={settings.viewDensity === 'comfortable'}
                                            onChange={() => updateSetting('viewDensity', 'comfortable')}
                                        />
                                        <span>আরামদায়ক</span>
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="density"
                                            checked={settings.viewDensity === 'spacious'}
                                            onChange={() => updateSetting('viewDensity', 'spacious')}
                                        />
                                        <span>প্রশস্ত</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'behavior' && (
                        <div className="settings-section">
                            <div className="setting-item">
                                <label className="toggle-label">
                                    <span>স্বয়ংক্রিয় রিফ্রেশ</span>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={settings.autoRefresh}
                                        onChange={(e) => updateSetting('autoRefresh', e.target.checked)}
                                    />
                                </label>
                            </div>

                            {settings.autoRefresh && (
                                <div className="setting-item">
                                    <label>রিফ্রেশ ইন্টারভাল: {settings.refreshInterval / 60000} মিনিট</label>
                                    <input
                                        type="range"
                                        min="60000"
                                        max="600000"
                                        step="60000"
                                        value={settings.refreshInterval}
                                        onChange={(e) => updateSetting('refreshInterval', parseInt(e.target.value))}
                                        className="slider"
                                    />
                                </div>
                            )}

                            <div className="setting-item">
                                <label>প্রতি পেজে আইটেম: {settings.itemsPerPage}</label>
                                <input
                                    type="range"
                                    min="10"
                                    max="50"
                                    step="5"
                                    value={settings.itemsPerPage}
                                    onChange={(e) => updateSetting('itemsPerPage', parseInt(e.target.value))}
                                    className="slider"
                                />
                            </div>

                            <div className="setting-item">
                                <label>ডিফল্ট ক্যাটাগরি</label>
                                <select
                                    value={settings.defaultCategory}
                                    onChange={(e) => updateSetting('defaultCategory', e.target.value)}
                                    className="select"
                                >
                                    <option value="All">সব</option>
                                    <option value="Politics">রাজনীতি</option>
                                    <option value="Sports">খেলা</option>
                                    <option value="Entertainment">বিনোদন</option>
                                    <option value="Business">ব্যবসা</option>
                                    <option value="Technology">প্রযুক্তি</option>
                                    <option value="World">বিশ্ব</option>
                                </select>
                            </div>

                            <div className="setting-item">
                                <label className="toggle-label">
                                    <span>পঠিত নিবন্ধ ট্র্যাক করুন</span>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={settings.trackReadArticles}
                                        onChange={(e) => updateSetting('trackReadArticles', e.target.checked)}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <div className="settings-section">
                            <div className="setting-item">
                                <h4>ক্যাশ ম্যানেজমেন্ট</h4>
                                <button className="action-btn danger" onClick={handleClearCache}>
                                    <Trash2 size={18} />
                                    ক্যাশ মুছে ফেলুন
                                </button>
                                <p className="help-text">সংরক্ষিত সংবাদ ক্যাশ মুছে ফেলুন</p>
                            </div>

                            <div className="setting-item">
                                <h4>পঠিত ইতিহাস</h4>
                                <button className="action-btn danger" onClick={handleClearHistory}>
                                    <Trash2 size={18} />
                                    ইতিহাস মুছে ফেলুন
                                </button>
                                <p className="help-text">পঠিত নিবন্ধের রেকর্ড মুছে ফেলুন</p>
                            </div>

                            <div className="setting-item">
                                <h4>সেটিংস ব্যাকআপ</h4>
                                <div className="button-group">
                                    <button className="action-btn" onClick={handleExportSettings}>
                                        <Download size={18} />
                                        এক্সপোর্ট
                                    </button>
                                    <label className="action-btn">
                                        <Upload size={18} />
                                        ইম্পোর্ট
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImportSettings}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="setting-item">
                                <h4>রিসেট করুন</h4>
                                {!showResetConfirm ? (
                                    <button className="action-btn danger" onClick={() => setShowResetConfirm(true)}>
                                        <RotateCcw size={18} />
                                        ডিফল্টে রিসেট করুন
                                    </button>
                                ) : (
                                    <div className="confirm-box">
                                        <p>আপনি কি নিশ্চিত? সমস্ত সেটিংস ডিফল্টে ফিরে যাবে।</p>
                                        <div className="button-group">
                                            <button className="action-btn danger" onClick={handleResetSettings}>হ্যাঁ, রিসেট করুন</button>
                                            <button className="action-btn" onClick={() => setShowResetConfirm(false)}>বাতিল</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
