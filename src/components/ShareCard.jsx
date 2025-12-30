import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { Download, Share2, X, Image } from 'lucide-react';
import './ShareCard.css';

const ShareCard = ({ news, onClose }) => {
    const cardRef = useRef(null);
    const [generating, setGenerating] = useState(true);
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
        if (!cardRef.current) {
            console.error('Canvas Ref is null');
            return;
        }

        console.log('Starting image generation for:', title);
        setGenerating(true);

        // Timeout promise to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout after 8s')), 8000)
        );

        try {
            console.log('Waiting 500ms for images...');
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvasPromise = html2canvas(cardRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#1e293b',
                logging: true
            });

            console.log('Calling html2canvas...');
            // Race against timeout
            const canvas = await Promise.race([canvasPromise, timeoutPromise]);
            console.log('Canvas created:', canvas.width, 'x', canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    console.log('Blob created:', blob.size);
                    setGeneratedBlob(blob);
                    setPreviewUrl(URL.createObjectURL(blob));
                } else {
                    console.error('Blob is null');
                }
                setGenerating(false);
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Failed to generate image:', error);
            setGenerating(false);
        }
    };

    useEffect(() => {
        generateImage();

        // Cleanup
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, []);

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
            alert(`সংরক্ষণ ব্যর্থ হয়েছে: ${error.message || error}`);
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
            // It often fails on desktop or if canceling share sheet, no need to alert error always
        }
    };

    // Show source if generating OR if we don't have a preview yet (failure case)
    const showSource = generating || !previewUrl;

    return (
        <div className="share-card-overlay">
            <div className="share-card-container">
                <button className="share-card-close" onClick={onClose} style={{ zIndex: 3001 }}>
                    <X size={24} />
                </button>

                <h3 className="share-card-title">
                    <Image size={20} />
                    ফটো কার্ড
                </h3>

                {/* Container for the DOM element - needed for generation but hidden after */}
                <div
                    className="share-card-preview"
                    style={{
                        position: showSource ? 'relative' : 'absolute',
                        opacity: showSource ? 1 : 0,
                        pointerEvents: 'none',
                        zIndex: showSource ? 1 : -1
                    }}
                >
                    <div className="photo-card" ref={cardRef}>
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

                {/* Show generating state or final result */}
                {generating ? (
                    <div className="generating-state">
                        <div className="loader-spinner"></div>
                        <p>কার্ড তৈরি হচ্ছে...</p>
                    </div>
                ) : (
                    previewUrl && (
                        <div className="generated-preview show">
                            <img src={previewUrl} alt="Generated card" />
                        </div>
                    )
                )}

                {/* Actions - only show when ready */}
                {!generating && (
                    <div className="share-card-actions">
                        <button className="btn-download" onClick={downloadImage}>
                            <Download size={18} />
                            ডাউনলোড
                        </button>
                        <button className="btn-share" onClick={shareImage}>
                            <Share2 size={18} />
                            শেয়ার
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareCard;
