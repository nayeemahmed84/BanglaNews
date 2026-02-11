/**
 * Story Clustering Utility
 * Groups articles from different sources about the same event.
 */

/**
 * Calculate similarity between two strings based on common words.
 */
function getSimilarity(s1, s2) {
    const words1 = new Set(s1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(s2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

/**
 * Cluster articles based on title similarity.
 * @param {Array} articles 
 * @param {number} threshold - Minimum similarity (0-1) to be considered the same story
 */
export function clusterArticles(articles, threshold = 0.25) {
    const clusters = [];
    const processedIndices = new Set();

    // Sort by date descending to prioritize newest
    const sorted = [...articles].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    for (let i = 0; i < sorted.length; i++) {
        if (processedIndices.has(i)) continue;

        const cluster = [sorted[i]];
        processedIndices.add(i);

        for (let j = i + 1; j < sorted.length; j++) {
            if (processedIndices.has(j)) continue;

            const similarity = getSimilarity(sorted[i].title, sorted[j].title);
            if (similarity >= threshold) {
                cluster.push(sorted[j]);
                processedIndices.add(j);
            }
        }
        clusters.push(cluster);
    }

    return clusters.map(items => ({
        id: items[0].id, // Use newest as primary
        primary: items[0],
        related: items.slice(1),
        count: items.length,
        sources: Array.from(new Set(items.map(item => item.source))),
        isCluster: items.length > 1
    }));
}
