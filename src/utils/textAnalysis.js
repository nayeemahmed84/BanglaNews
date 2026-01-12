
// Common Bengali stopwords to exclude from trending analysis
const STOP_WORDS = new Set([
    'ও', 'এবং', 'কিন্তু', 'অথবা', 'তবে', 'জন্য', 'কারণে', 'দ্বারা', 'থেকে', 'চেয়ে',
    'পর', 'উপরে', 'নিচে', 'মধ্যে', 'কাছে', 'দিকে', 'কি', 'কেন', 'কিভাবে', 'কবে',
    'কোথায়', 'কোন', 'কে', 'কার', 'কাকে', 'যে', 'যা', 'যিনি', 'যারা', 'যার',
    'হলো', 'হচ্ছে', 'হব', 'হতে', 'হয়ে', 'আছে', 'নেই', 'ছিল', 'থাকবে', 'নয়',
    'না', 'নি', 'এই', 'ওই', 'সেই', 'সব', 'সকল', 'কিছু', 'অনেক', 'এক', 'দুই',
    'করা', 'করে', 'করেন', 'করছে', 'করছেন', 'শুরু', 'শেষ', 'বলা', 'বলে', 'বলেন',
    'নিয়ে', 'দিয়ে', 'গেছে', 'গেল', 'যাবে', 'যায়', 'আসা', 'আসে', 'আসেন', 'দেওয়া',
    'দেয়', 'দিতে', 'নেওয়া', 'নেয়', 'নিতে', 'আজ', 'কাল', 'গতকাল', 'আগামীকাল',
    'এখন', 'তখন', 'যখন', 'গুলি', 'গুলো', 'টি', 'টা', 'খানা', 'খানি', 'জন',
    'করেছে', 'করলেন', 'রয়েছে', 'রইল', 'এর', 'কে', 'তে', 'র', 'য়', 'বিষয়',
    'সাথে', 'সঙ্গে', 'উপর', 'নিচ', 'পাশ', 'সামনে', 'পিছনে', 'মত', 'মতো',
    'ভিডিও', 'ছবি', 'লাইভ', 'খবর', 'সংবাদ', 'আপডেট', 'বাংলাদেশ', 'ঢাকা',
    'দেশ', 'নতুন', 'বছর' // Often too generic for "trending" specific contexts, optional
]);

export function getTrendingTopics(newsArray, limit = 8) {
    if (!newsArray || newsArray.length === 0) return [];

    const wordCounts = {};

    newsArray.forEach(item => {
        if (!item.title) return;

        // Clean title: remove special chars, digits (except maybe years?), normalize spacing
        const cleanTitle = item.title
            .replace(/[।\-,|!?"'`:;()\[\]{}]/g, ' ') // Remove punctuation
            .replace(/\s+/g, ' ')
            .trim();

        const words = cleanTitle.split(' ');

        words.forEach(word => {
            // Basic cleaning
            const w = word.trim();

            // Filter out small words, stopwords, numbers
            if (w.length < 3) return; // Skip very short words
            if (STOP_WORDS.has(w)) return;
            // Skip numbers
            if (/^[০-৯0-9]+$/.test(w)) return;

            if (wordCounts[w]) {
                wordCounts[w]++;
            } else {
                wordCounts[w] = 1;
            }
        });
    });

    // Convert to array and sort
    const sortedWords = Object.entries(wordCounts)
        .sort(([, countA], [, countB]) => countB - countA) // Descending count
        .filter(([, count]) => count > 1) // Must appear at least twice to be a "trend"
        .slice(0, limit)
        .map(([word]) => word);

    return sortedWords;
}
