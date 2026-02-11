import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Trash2, Download, Upload, AlertCircle, Plus, Search, Globe, Rss } from 'lucide-react';
import { discoverSource, DEFAULT_SOURCES } from '../services/newsService';
import './Settings.css';

const DEFAULT_SETTINGS = {
    sources: DEFAULT_SOURCES,
    enabledSources: [], // Will be filled with IDs
    theme: 'light',
    fontSize: 16,
    viewDensity: 'comfortable',
    autoRefresh: true,
    refreshInterval: 300000,
    enableClustering: true,
    showSourceReliability: true,
    itemsPerPage: 20,
    defaultCategory: 'All',
    trackReadArticles: true,
    cacheEnabled: true,
    imagePreloading: true,
    fontFamily: 'Inter'
};

const Settings = ({ isOpen, onClose, currentSettings, onSettingsChange }) => {
    const [activeTab, setActiveTab] = useState('sources');
    const [settings, setSettings] = useState(currentSettings || DEFAULT_SETTINGS);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Add Source State
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState(null);

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

    // Fix: Toggle source safely without affecting other settings
    const toggleSource = (sourceId) => {
        const currentEnabled = settings.enabledSources || [];
        const enabledSources = currentEnabled.includes(sourceId)
            ? currentEnabled.filter(id => id !== sourceId)
            : [...currentEnabled, sourceId];

        // Setup new settings ensure we preserve everything else (especially theme)
        const newSettings = {
            ...settings,
            enabledSources
        };

        setSettings(newSettings);
        if (onSettingsChange) {
            onSettingsChange(newSettings);
        }
    };

    const selectAllSources = () => {
        const allIds = (settings.sources || DEFAULT_SOURCES).map(s => s.id);
        updateSetting('enabledSources', allIds);
    };

    const deselectAllSources = () => {
        updateSetting('enabledSources', []);
    };

    const handleAddSource = async (e) => {
        e.preventDefault();
        if (!newSourceUrl.trim()) return;

        setIsDiscovering(true);
        setDiscoveryError(null);

        try {
            const result = await discoverSource(newSourceUrl);

            // Check if already exists
            const existing = (settings.sources || DEFAULT_SOURCES).find(s => s.id === result.id);
            if (existing) {
                setDiscoveryError('এই সংবাদ উৎসটি ইতিমধ্যে যুক্ত আছে।');
                setIsDiscovering(false);
                return;
            }

            // Update sources AND enable the new one
            setSettings(prevSettings => {
                // Re-calculate based on latest state to avoid stale closure
                const currentSources = prevSettings.sources || DEFAULT_SOURCES;
                // Avoid duplicates check again just in case
                if (currentSources.find(s => s.id === result.id)) return prevSettings;

                const newSources = [...currentSources, result];
                const newEnabled = [...(prevSettings.enabledSources || []), result.id];

                const newSettings = {
                    ...prevSettings,
                    sources: newSources,
                    enabledSources: newEnabled
                };

                // Notify parent safely
                if (onSettingsChange) {
                    Promise.resolve().then(() => onSettingsChange(newSettings));
                }

                return newSettings;
            });

            setNewSourceUrl('');
            alert(`সফলভাবে যুক্ত হয়েছে: ${result.name}`);
        } catch (err) {
            setDiscoveryError(err.message || 'সংবাদ উৎস খুঁজে পাওয়া যায়নি।');
        } finally {
            setIsDiscovering(false);
        }
    };

    // New Feature: Delete Source
    const handleDeleteSource = (sourceId, sourceName) => {
        if (!window.confirm(`আপনি কি নিশ্চিত যে "${sourceName}" মুছে ফেলতে চান?`)) return;

        setSettings(prevSettings => {
            const currentSources = prevSettings.sources || DEFAULT_SOURCES;
            const newSources = currentSources.filter(s => s.id !== sourceId);

            // Also remove from enabled list
            const newEnabled = (prevSettings.enabledSources || []).filter(id => id !== sourceId);

            const newSettings = {
                ...prevSettings,
                sources: newSources,
                enabledSources: newEnabled
            };

            if (onSettingsChange) {
                Promise.resolve().then(() => onSettingsChange(newSettings));
            }
            return newSettings;
        });
    };

    const handleClearCache = () => {
        localStorage.removeItem('news_cache');
        alert('ক্যাশ সফলভাবে মুছে ফেলা হয়েছে');
    };

    const handleClearHistory = () => {
        localStorage.removeItem('read_news_ids');
        alert('পঠিত ইতিহাস সফলভাবে মুছে ফেলা হয়েছে');
    };

    const handleExportBackup = () => {
        const backup = {
            settings: settings,
            readIds: JSON.parse(localStorage.getItem('read_news_ids') || '[]'),
            bookmarks: JSON.parse(localStorage.getItem('bookmarked_news_ids') || '[]'),
            followedTopics: JSON.parse(localStorage.getItem('followed_topics') || '[]'),
            version: 1,
            timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `banglanews-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportBackup = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);

                // Check if it's a full backup (v1) or legacy settings only
                if (imported.version && imported.settings) {
                    // Full Restore
                    localStorage.setItem('app_settings', JSON.stringify(imported.settings));

                    if (imported.readIds) localStorage.setItem('read_news_ids', JSON.stringify(imported.readIds));
                    if (imported.bookmarks) localStorage.setItem('bookmarked_news_ids', JSON.stringify(imported.bookmarks));
                    if (imported.followedTopics) localStorage.setItem('followed_topics', JSON.stringify(imported.followedTopics));

                    setSettings(imported.settings);
                    if (onSettingsChange) onSettingsChange(imported.settings);

                    alert('ব্যাকআপ সফলভাবে রিস্টোর করা হয়েছে। অ্যাপ রিলোড হচ্ছে...');
                    window.location.reload();
                } else if (imported.sources || imported.enabledSources) {
                    // Legacy Settings Import
                    setSettings(imported);
                    if (onSettingsChange) onSettingsChange(imported);
                    alert('সেটিংস সফলভাবে আমদানি করা হয়েছে');
                } else {
                    throw new Error("Invalid Format");
                }
            } catch (err) {
                alert('ফাইল ইম্পোর্ট করতে ব্যর্থ হয়েছে: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    const handleResetSettings = () => {
        const resetState = {
            ...DEFAULT_SETTINGS,
            sources: DEFAULT_SOURCES, // Reset to default sources
            enabledSources: DEFAULT_SOURCES.map(s => s.id)
        };
        setSettings(resetState);
        if (onSettingsChange) {
            onSettingsChange(resetState);
        }
        setShowResetConfirm(false);
        alert('সেটিংস রিসেট করা হয়েছে');
    };

    if (!isOpen) return null;

    // Use settings.sources or fallback to default
    const currentSources = settings.sources && settings.sources.length > 0
        ? settings.sources
        : DEFAULT_SOURCES;

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
                            {/* Add Source Form */}
                            <div className="add-source-box">
                                <h4>নতুন সংবাদ উৎস যোগ করুন</h4>
                                <form onSubmit={handleAddSource} className="source-input-group">
                                    <input
                                        type="text"
                                        placeholder="ওয়েবসাইট বা RSS লিংক (যেমন: bdnews24.com)"
                                        value={newSourceUrl}
                                        onChange={(e) => setNewSourceUrl(e.target.value)}
                                        disabled={isDiscovering}
                                    />
                                    <button type="submit" className="add-btn" disabled={isDiscovering || !newSourceUrl}>
                                        {isDiscovering ? <span className="infinite-spin">↻</span> : <Plus size={18} />}
                                        {isDiscovering ? 'খোঁজা হচ্ছে...' : 'যোগ করুন'}
                                    </button>
                                </form>
                                {discoveryError && (
                                    <div className="error-msg">
                                        <AlertCircle size={14} />
                                        <span>{discoveryError}</span>
                                    </div>
                                )}
                                <p className="help-text">
                                    যে কোনো সংবাদ ওয়েবসাইটের লিংক দিন, অ্যাপ স্বয়ংক্রিয়ভাবে খবর খুঁজে নেবে।
                                </p>
                            </div>

                            <hr className="divider" />

                            <div className="section-header">
                                <h3>সক্রিয় সংবাদ উৎস ({currentSources.length})</h3>
                                <div className="source-actions">
                                    <button className="text-btn" onClick={selectAllSources}>সব নির্বাচন করুন</button>
                                    <button className="text-btn" onClick={deselectAllSources}>সব বাতিল করুন</button>
                                </div>
                            </div>

                            <div className="sources-list">
                                {currentSources.map(source => {
                                    const isEnabled = (settings.enabledSources || []).includes(source.id);
                                    // Use hardcoded check to see if it's a default source (optional: prevents deleting defaults if desired, but user asked to delete)
                                    // User said "User should be able to delete a news source", usually implies custom ones, but maybe defaults too.
                                    // I'll allow deleting any source.

                                    return (
                                        <div key={source.id} className={`source-row ${isEnabled ? 'enabled' : ''}`}>
                                            <label className="source-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={isEnabled}
                                                    onChange={() => toggleSource(source.id)}
                                                />
                                                <span className="source-color" style={{ backgroundColor: source.color || '#ccc' }}></span>
                                                <div className="source-info">
                                                    <span className="source-name">{source.name}</span>
                                                    <span className="source-domain">{new URL(source.homepage || source.url || 'http://localhost').hostname}</span>
                                                </div>
                                            </label>

                                            <div className="source-row-actions">
                                                {source.url ? (
                                                    <span className="badge rss" title="RSS ফিড উপলব্ধ"><Rss size={12} /> RSS</span>
                                                ) : (
                                                    <span className="badge scrape" title="ওয়েব স্ক্র্যাপিং"><Globe size={12} /> Web</span>
                                                )}

                                                <button
                                                    className="icon-btn delete-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Stop click from toggling checkbox logic if bubbling
                                                        handleDeleteSource(source.id, source.name);
                                                    }}
                                                    title="মুছে ফেলুন"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {(settings.enabledSources || []).length === 0 && (
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
                                <label>ফন্ট ফ্যামিলি</label>
                                <select
                                    value={settings.fontFamily || 'Inter'}
                                    onChange={(e) => updateSetting('fontFamily', e.target.value)}
                                    className="select"
                                >
                                    <option value="Inter">Default (Inter)</option>
                                    <option value="'Hind Siliguri', sans-serif">Hind Siliguri (Modern sans)</option>
                                    <option value="'Noto Serif Bengali', serif">Noto Serif Bengali (Classic serif)</option>
                                </select>
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

                            <div className="setting-item">
                                <label className="toggle-label">
                                    <span>খবর গ্রুপিং (Story Clustering)</span>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={settings.enableClustering}
                                        onChange={(e) => updateSetting('enableClustering', e.target.checked)}
                                    />
                                </label>
                                <p className="help-text">একই বিষয়ের বিভিন্ন খবরাখবর একত্রে দেখান</p>
                            </div>

                            <div className="setting-item">
                                <label className="toggle-label">
                                    <span>উৎস নির্ভরযোগ্যতা নির্দেশক</span>
                                    <input
                                        type="checkbox"
                                        className="toggle"
                                        checked={settings.showSourceReliability}
                                        onChange={(e) => updateSetting('showSourceReliability', e.target.checked)}
                                    />
                                </label>
                                <p className="help-text">খবরের উৎস এবং কাভারেজ সংক্রান্ত তথ্য দেখান</p>
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
                                <h4>ডেটা ব্যাকআপ ও রিস্টোর</h4>
                                <div className="button-group">
                                    <button className="action-btn" onClick={handleExportBackup}>
                                        <Download size={18} />
                                        ব্যাকআপ নিন
                                    </button>
                                    <label className="action-btn">
                                        <Upload size={18} />
                                        রিস্টোর করুন
                                        <input
                                            type="file"
                                            accept=".json"
                                            onChange={handleImportBackup}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                                <p className="help-text">আপনার সেটিংস, বুকমার্ক এবং পঠিত ইতিহাস সংরক্ষণ করুন</p>
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
            </div >
        </div >
    );
};

export default Settings;
