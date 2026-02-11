
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

// Sentiment Analysis Rules
const SENTIMENT_RULES = {
    positive: [
        'জয়', 'সাফল্য', 'উন্নয়ন', 'খুশি', 'ভালো', 'সেরা', 'উপহার', 'ইতিবাচক', 'স্বীকৃতি',
        'রেকর্ড', 'স্বস্তি', 'সফল', 'পুরস্কার', 'গর্ব', 'উৎসব', 'আশা', 'নতুন', 'উদ্বোধন',
        'উন্নতি', 'জয়লাভ'
    ],
    negative: [
        'মৃত্যু', 'নিহত', 'হামলা', 'দুর্ঘটনা', 'শোক', 'অভিযোগ', 'গ্রেফতার', 'আটক', 'ক্ষতি',
        'অপরাধ', 'বিপদ', 'অসুস্থ', 'অস্থিরতা', 'বিস্ফোরণ', 'আগুন', 'খুন', 'ধর্ষণ', 'হুমকি',
        'নিখোঁজ', 'আহত', 'সংঘাত', 'ধর্ষণ', 'চুরি', 'ছিনতাই', 'মৃত', 'আগুনে'
    ]
};

export function analyzeSentiment(text) {
    if (!text) return 'neutral';

    const t = text.toLowerCase();
    let score = 0;

    SENTIMENT_RULES.positive.forEach(word => {
        if (t.includes(word)) score++;
    });

    SENTIMENT_RULES.negative.forEach(word => {
        if (t.includes(word)) score--;
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
}

// Improved Categorization Logic
export function getSmartCategory(text) {
    if (!text) return 'General';

    const normalize = (s) => {
        if (!s) return '';
        let out = s.replace(/<[^>]+>/g, ' ');
        out = out.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()"'·…—––]/g, ' ');
        out = out.replace(/\s{2,}/g, ' ').trim();
        return out.toLowerCase();
    };

    const t = normalize(String(text));

    const CATEGORIES = {
        Sports: [
            ['খেলা', 3], ['ক্রিকেট', 5], ['ফুটবল', 5], ['ম্যাচ', 3], ['টেস্ট', 2], ['সাকিব', 3], ['মেসি', 3], ['গোল', 2], ['উইকেট', 2], ['রান', 2], ['টুর্নামেন্ট', 2], ['বিশ্বকাপ', 4], ['বিপিএল', 4], ['আইপিএল', 4]
        ],
        Politics: [
            ['রাজনীতি', 5], ['নির্বাচন', 5], ['সরকার', 4], ['বিরোধী', 3], ['মন্ত্রি', 3], ['মন্ত্রিপরিষদ', 2], ['প্রধানমন্ত্রী', 4], ['বিজেপি', 3], ['বিএনপি', 4], ['আওয়ামী', 4], ['সভাপতি', 2], ['দল', 2], ['নেতা', 2], ['মিছিল', 3], ['বিক্ষোভ', 3], ['আন্দোলন', 4]
        ],
        Entertainment: [
            ['বিনোদন', 4], ['চলচ্চিত্র', 3], ['সিনেমা', 3], ['অভিনেতা', 3], ['অভিনেত্রী', 3], ['গান', 2], ['সিরিয়াল', 2], ['বলিউড', 3], ['ঢালিউড', 3], ['নাটক', 2], ['সেলিব্রিটি', 3]
        ],
        Business: [
            ['অর্থনীতি', 5], ['বাজেট', 4], ['শেয়ার', 4], ['স্টক', 4], ['ব্যাংক', 3], ['টাকা', 3], ['অর্থ', 3], ['বিনিয়োগ', 3], ['বাণিজ্য', 4], ['বাজার', 2], ['সঞ্চয়', 2]
        ],
        Technology: [
            ['প্রযুক্তি', 4], ['স্মার্টফোন', 4], ['মোবাইল', 3], ['কম্পিউটার', 3], ['ইন্টারনেট', 3], ['এআই', 4], ['ai', 2], ['গ্যাজেট', 3], ['অ্যাপ', 2], ['সফটওয়্যার', 3]
        ],
        Health: [
            ['স্বাস্থ্য', 4], ['কোভিড', 4], ['ভ্যাকসিন', 4], ['রোগ', 3], ['ডায়াবেটিস', 2], ['হাসপাতাল', 2], ['ডাক্তার', 2], ['ওষুধ', 2], ['ক্যান্সার', 2], ['ডেঙ্গু', 4]
        ],
        World: [
            ['প্রবাস', 2], ['বিশ্ব', 2], ['সংঘর্ষ', 3], ['আন্তর্জাতিক', 4], ['যুক্তরাষ্ট্র', 2], ['ভারত', 2], ['ফিলিস্তিন', 3], ['ইসরায়েল', 3], ['ইউক্রেন', 3], ['রাশিয়া', 3], ['ইউরোপ', 2]
        ],
        Lifestyle: [
            ['লাইফস্টাইল', 3], ['ভ্রমণ', 3], ['রান্না', 2], ['ফ্যাশন', 3], ['রেসিপি', 2], ['টিপস', 2]
        ]
    };

    const scores = {};
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
        let score = 0;
        for (const [kw, w] of keywords) {
            if (t.includes(kw)) {
                const occurrences = (t.split(kw).length - 1) || 1;
                score += w * occurrences;
            }
        }
        scores[cat] = score;
    }

    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestCat, bestScore] = entries[0];

    return bestScore > 0 ? bestCat : 'General';
}
