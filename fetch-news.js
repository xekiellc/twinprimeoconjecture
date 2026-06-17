
/* ================================================================
   fetch-news.js — Twin Prime Conjecture
   Fetches mathematics news via NewsAPI + filters with Claude
   Run by: .github/workflows/fetch-news.yml
   Output: news.json
   ================================================================ */

const https = require('https');
const fs = require('fs');
const path = require('path');

/* ── CONFIG ────────────────────────────────────────────────────── */
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OUTPUT_FILE = path.join(__dirname, 'news.json');
const MAX_ARTICLES = 12;

const QUERIES = [
  'prime numbers mathematics',
  'number theory breakthrough',
  'Riemann hypothesis',
  'twin prime conjecture',
  'mathematics unsolved problems',
  'Terence Tao mathematics',
  'James Maynard prime numbers'
];

/* ── HTTP HELPER ───────────────────────────────────────────────── */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'TwinPrimeConjecture/1.0',
        ...headers
      }
    };
    https.get(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

/* ── FETCH NEWS ────────────────────────────────────────────────── */
async function fetchArticles() {
  const seen = new Set();
  const articles = [];

  for (const query of QUERIES) {
    if (articles.length >= 40) break;
    try {
      const encoded = encodeURIComponent(query);
      const url = `https://newsapi.org/v2/everything?q=${encoded}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;
      const data = await httpsGet(url);

      if (data.status !== 'ok' || !data.articles) continue;

      for (const a of data.articles) {
        if (!a.title || !a.url) continue;
        if (seen.has(a.url)) continue;
        if (a.title === '[Removed]') continue;
        seen.add(a.url);
        articles.push({
          title: a.title,
          description: a.description || '',
          url: a.url,
          source: { name: a.source?.name || 'Unknown' },
          publishedAt: a.publishedAt || ''
        });
      }

      // Respect NewsAPI rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`Query failed: "${query}" — ${err.message}`);
    }
  }

  return articles;
}

/* ── CLAUDE FILTER ─────────────────────────────────────────────── */
async function filterWithClaude(articles) {
  if (!ANTHROPIC_API_KEY) {
    console.log('No Anthropic key — skipping Claude filter, using all articles.');
    return articles.slice(0, MAX_ARTICLES);
  }

  const articleList = articles.map((a, i) =>
    `${i + 1}. TITLE: ${a.title}\n   SOURCE: ${a.source.name}\n   DESC: ${a.description?.slice(0, 150) || 'none'}`
  ).join('\n\n');

  const prompt = `You are a curator for twinprimeconjecture.com, a mathematics education site focused on prime numbers, number theory, and unsolved mathematical problems.

Review these news articles and return a JSON array of the index numbers (1-based) of the ${MAX_ARTICLES} most relevant articles. Prioritize:
- Prime numbers, twin primes, prime gaps
- Number theory breakthroughs
- Famous mathematicians (Tao, Maynard, Zhang, etc.)
- Unsolved mathematics problems (Riemann, Goldbach, Collatz, P vs NP)
- Mathematical proofs and discoveries
- Computational mathematics records

Exclude:
- Sports, politics, entertainment, business news
- Articles with no mathematical relevance
- Duplicates or near-duplicates

Return ONLY a raw JSON array of integers, no markdown, no explanation. Example: [1,3,5,7,9,11,12,14,15,16]

Articles:
${articleList}`;

  try {
    const response = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      }
    );

    const text = response?.content?.[0]?.text?.trim() || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const indices = JSON.parse(clean);

    if (!Array.isArray(indices)) throw new Error('Response is not an array');

    const filtered = indices
      .filter(i => typeof i === 'number' && i >= 1 && i <= articles.length)
      .map(i => articles[i - 1]);

    console.log(`Claude selected ${filtered.length} articles from ${articles.length} candidates.`);
    return filtered;
  } catch (err) {
    console.error(`Claude filter error: ${err.message} — falling back to recency sort.`);
    return articles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, MAX_ARTICLES);
  }
}

/* ── MAIN ──────────────────────────────────────────────────────── */
async function main() {
  if (!NEWS_API_KEY) {
    console.error('ERROR: NEWS_API_KEY environment variable not set.');
    process.exit(1);
  }

  console.log('Fetching mathematics news...');
  const articles = await fetchArticles();
  console.log(`Fetched ${articles.length} raw articles.`);

  if (articles.length === 0) {
    console.log('No articles fetched — preserving existing news.json.');
    process.exit(0);
  }

  console.log('Filtering with Claude...');
  const filtered = await filterWithClaude(articles);

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2));
  console.log(`Done. Wrote ${filtered.length} articles to news.json.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
