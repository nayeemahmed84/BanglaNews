import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Flame, Calendar, X, BookOpen, Award, Zap, PieChart as PieIcon } from 'lucide-react';
import './StatsModal.css';

const StatsModal = ({ isOpen, onClose, readIds, allNews }) => {
    if (!isOpen) return null;

    // Calculate stats
    const stats = useMemo(() => {
        const totalRead = readIds.size;

        // Find read articles details from allNews (if still available in feed)
        // Note: readIds might include IDs not present in current allNews if feeds updated, 
        // effectively we can only analyze what we have data for.
        const readArticles = allNews.filter(item => readIds.has(item.id));

        // Read activity log for heatmap
        const savedLog = localStorage.getItem('read_activity_log');
        const activityLog = savedLog ? JSON.parse(savedLog) : {};

        // Category breakdown
        const categoryCounts = {};
        readArticles.forEach(item => {
            const cat = item.category || 'Unknown';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        const categoryData = Object.entries(categoryCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5 categories

        // Source breakdown
        const sourceCounts = {};
        readArticles.forEach(item => {
            const src = item.source || 'Unknown';
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });

        // Favorite Source
        let favoriteSource = { name: '-', count: 0 };
        Object.entries(sourceCounts).forEach(([name, count]) => {
            if (count > favoriteSource.count) favoriteSource = { name, count };
        });

        // Reading Level / Title (Fun element)
        let level = 'Newcomer';
        if (totalRead > 10) level = 'Regular Reader';
        if (totalRead > 50) level = 'News Buff';
        if (totalRead > 100) level = 'Knowledge Seeker';

        return {
            totalRead,
            categoryData,
            favoriteSource,
            level,
            activityLog
        };
    }, [readIds, allNews]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="stats-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="stats-modal fade-in">
                <div className="stats-header">
                    <h2><PieIcon className="icon-gap" /> আপনার পড়ার পরিসংখ্যান</h2>
                    <button className="close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="stats-grid">
                    {/* Key Metrics Cards */}
                    <div className="stat-card blue">
                        <BookOpen size={24} />
                        <div className="stat-value">{stats.totalRead}</div>
                        <div className="stat-label">মোট পড়া হয়েছে</div>
                    </div>

                    <div className="stat-card purple">
                        <Award size={24} />
                        <div className="stat-value text-sm">{stats.level}</div>
                        <div className="stat-label">আপনার লেভেল</div>
                    </div>

                    <div className="stat-card orange">
                        <Zap size={24} />
                        <div className="stat-value text-sm">{stats.favoriteSource.name}</div>
                        <div className="stat-label">প্রিয় উৎস</div>
                    </div>
                </div>

                {/* Heatmap Section */}
                <div className="heatmap-section">
                    <h3>পড়ার ধারাবাহিকতা (গত ১২ সপ্তাহ)</h3>
                    <ReadingHeatmap activity={stats.activityLog} />
                </div>

                {/* Chart Section */}
                <div className="chart-section">
                    <h3>পছন্দের বিষয়সমূহ</h3>
                    {stats.categoryData.length > 0 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={stats.categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [`${value} টি`, name]}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="legend">
                                {stats.categoryData.map((entry, index) => (
                                    <div key={index} className="legend-item">
                                        <div className="legend-color" style={{ background: COLORS[index % COLORS.length] }}></div>
                                        <span>{entry.name} ({entry.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-stats">
                            <p>এখনও পর্যাপ্ত তথ্য নেই। আরও কিছু খবর পড়ুন!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReadingHeatmap = ({ activity }) => {
    const data = useMemo(() => {
        const weeks = [];
        const today = new Date();
        // Go back 11 weeks + current week = 12 weeks
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (11 * 7) - today.getDay());

        for (let w = 0; w < 12; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + (w * 7) + d);
                const dateStr = date.toISOString().split('T')[0];
                const count = activity[dateStr] ? activity[dateStr].length : 0;
                week.push({ date: dateStr, count });
            }
            weeks.push(week);
        }
        return weeks;
    }, [activity]);

    const getIntensity = (count) => {
        if (count === 0) return 'level-0';
        if (count <= 2) return 'level-1';
        if (count <= 5) return 'level-2';
        if (count <= 10) return 'level-3';
        return 'level-4';
    };

    return (
        <div className="heatmap-container">
            <div className="heatmap-grid">
                {data.map((week, wIdx) => (
                    <div key={wIdx} className="heatmap-week">
                        {week.map((day, dIdx) => (
                            <div
                                key={dIdx}
                                className={`heatmap-day ${getIntensity(day.count)}`}
                                title={`${day.date}: ${day.count} টি পঠিত`}
                            ></div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="heatmap-legend">
                <span>কম</span>
                <div className="legend-cells">
                    <div className="legend-cell level-0"></div>
                    <div className="legend-cell level-1"></div>
                    <div className="legend-cell level-2"></div>
                    <div className="legend-cell level-3"></div>
                    <div className="legend-cell level-4"></div>
                </div>
                <span>বেশি</span>
            </div>
        </div>
    );
};

export default StatsModal;
