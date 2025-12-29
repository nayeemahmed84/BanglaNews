import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { Download, Share2, X, Image } from 'lucide-react';
import './ShareCard.css';

const ShareCard = ({ news, onClose }) => {
    const cardRef = useRef(null);
    const [generating, setGenerating] = useState(false);
    const [generatedBlob, setGeneratedBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const { title, image, source, sourceColor, category, pubDate } = news;

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const generateImage = async () => {
        if (!cardRef.current) return;

        setGenerating(true);
        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#1e293b'
            });

            // Convert canvas to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    setGeneratedBlob(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Failed to generate image:', error);
            alert('ছবি তৈরি করতে সমস্যা হয়েছে');
        } finally {
            setGenerating(false);
        }
    };

    const downloadImage = async () => {
        if (!generatedBlob) return;

        try {
            // Check if running in Tauri
            if (window.__TAURI_INTERNALS__) {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

                const filePath = await save({
                    defaultPath: `bangla-news-card-${Date.now()}.png`,
                    filters: [{
                        name: 'Image',
                        extensions: ['png']
                    }]
                });

                if (filePath) {
                    const buffer = await generatedBlob.arrayBuffer();
                    const uint8Array = new Uint8Array(buffer);
                    await writeFile(filePath, uint8Array);
                    alert('সফলবাবে সংরক্ষণ করা হয়েছে!');
                }
            } else {
                // Web fallback
                saveAs(generatedBlob, `bangla-news-card-${Date.now()}.png`);
            }
        } catch (error) {
            console.error('Download failed:', error);
            saveAs(generatedBlob, `bangla-news-card-${Date.now()}.png`);
        }
    };

    const shareImage = async () => {
        if (!generatedBlob) return;

        try {
            const file = new File([generatedBlob], 'bangla-news-card.png', { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: title,
                    text: title
                });
            } else {
                // Fallback - download instead
                downloadImage();
            }
        } catch (error) {
            console.error('Share failed:', error);
            downloadImage();
        }
    };

    return (
        <div className="share-card-overlay">
            <div className="share-card-container">
                <button className="share-card-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <h3 className="share-card-title">
                    <Image size={20} />
                    ফটো কার্ড তৈরি করুন
                </h3>

                {/* The card that will be converted to image */}
                <div className="share-card-preview" ref={cardRef}>
                    <div className="photo-card">
                        {image ? (
                            <div className="photo-card-image">
                                <img src={image} alt={title} crossOrigin="anonymous" />
                            </div>
                        ) : (
                            <div className="photo-card-placeholder">
                                <span>{source}</span>
                            </div>
                        )}

                        <div className="photo-card-content">
                            <div className="photo-card-meta">
                                <span className="photo-card-source" style={{ backgroundColor: sourceColor }}>
                                    {source}
                                </span>
                                <span className="photo-card-category">{category}</span>
                            </div>

                            <h2 className="photo-card-headline">{title}</h2>

                            <div className="photo-card-footer">
                                <span className="photo-card-date">{formatDate(pubDate)}</span>
                                <span className="photo-card-branding">বাংলার খবর</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Generated preview */}
                {previewUrl && (
                    <div className="generated-preview">
                        <p>প্রিভিউ:</p>
                        <img src={previewUrl} alt="Generated card" />
                    </div>
                )}

                {/* Actions */}
                <div className="share-card-actions">
                    {!generatedBlob ? (
                        <button
                            className="btn-generate"
                            onClick={generateImage}
                            disabled={generating}
                        >
                            {generating ? 'তৈরি হচ্ছে...' : 'ছবি তৈরি করুন'}
                        </button>
                    ) : (
                        <>
                            <button className="btn-download" onClick={downloadImage}>
                                <Download size={18} />
                                ডাউনলোড
                            </button>
                            <button className="btn-share" onClick={shareImage}>
                                <Share2 size={18} />
                                শেয়ারকরুন
                            </button>
                            <button className="btn-regenerate" onClick={() => {
                                setGeneratedBlob(null);
                                if (previewUrl) URL.revokeObjectURL(previewUrl);
                                setPreviewUrl(null);
                            }}>
                                আবার তৈরি করুন
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareCard;
