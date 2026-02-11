import React from 'react';
import { X, Keyboard } from 'lucide-react';
import './KeyboardShortcuts.css';

const SHORTCUTS = [
    { section: 'নেভিগেশন' },
    { keys: ['J'], label: 'পরবর্তী খবরে যান' },
    { keys: ['K'], label: 'আগের খবরে যান' },
    { keys: ['O', 'Enter'], label: 'খবর খুলুন' },
    { keys: ['Esc'], label: 'বন্ধ করুন' },
    { section: 'একশন' },
    { keys: ['B'], label: 'বুকমার্ক করুন' },
    { keys: ['S'], label: 'শেয়ার করুন' },
    { keys: ['R'], label: 'রিফ্রেশ করুন' },
    { section: 'পপআপ নেভিগেশন' },
    { keys: ['←'], label: 'আগের খবর' },
    { keys: ['→'], label: 'পরবর্তী খবর' },
    { section: 'অন্যান্য' },
    { keys: ['?'], label: 'শর্টকাট দেখুন' },
];

const KeyboardShortcuts = ({ onClose }) => {
    return (
        <div className="shortcuts-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="shortcuts-modal">
                <div className="shortcuts-header">
                    <h2><Keyboard size={20} /> কীবোর্ড শর্টকাট</h2>
                    <button className="modal-close" onClick={onClose} style={{ position: 'static' }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="shortcuts-grid">
                    {SHORTCUTS.map((item, i) =>
                        item.section ? (
                            <div key={i} className="shortcut-divider">{item.section}</div>
                        ) : (
                            <div key={i} className="shortcut-row">
                                <span className="shortcut-label">{item.label}</span>
                                <div className="shortcut-keys">
                                    {item.keys.map((k, j) => (
                                        <React.Fragment key={j}>
                                            {j > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>বা</span>}
                                            <kbd className="shortcut-key">{k}</kbd>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcuts;
