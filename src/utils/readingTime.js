/**
 * Estimate reading time for Bengali/Bangla text.
 * Bengali reading speed is ~150 words/min on average.
 */

const BENGALI_WPM = 150;

/**
 * @param {string} text - Article text content
 * @returns {{ minutes: number, label: string }}
 */
export function estimateReadingTime(text) {
    if (!text) return { minutes: 0, label: '' };

    // Split on whitespace to count words (works for Bengali & English)
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(wordCount / BENGALI_WPM));

    // Convert to Bengali numerals
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const bnMinutes = String(minutes).split('').map(d => bnDigits[+d] || d).join('');

    return {
        minutes,
        label: `পড়তে ${bnMinutes} মিনিট`
    };
}
