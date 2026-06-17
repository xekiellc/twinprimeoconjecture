
/* ================================================================
   primes.js — Twin Prime Conjecture
   Shared prime utilities + D3 Ulam Spiral visualization
   Used by: tools.html, visualizer section
   ================================================================ */

/* ── CORE PRIME UTILITIES ──────────────────────────────────────── */

/**
 * Sieve of Eratosthenes
 * Returns a boolean array where index i is true if i is prime
 */
function sieve(limit) {
  const isP = new Array(limit + 1).fill(true);
  isP[0] = isP[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (isP[i]) {
      for (let j = i * i; j <= limit; j += i) {
        isP[j] = false;
      }
    }
  }
  return isP;
}

/**
 * Returns true if n is prime
 */
function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Returns true if n is part of a twin prime pair
 */
function isTwinPrime(n) {
  return isPrime(n) && (isPrime(n - 2) || isPrime(n + 2));
}

/**
 * Returns all primes up to limit
 */
function getPrimes(limit) {
  const isP = sieve(limit);
  const primes = [];
  for (let i = 2; i <= limit; i++) {
    if (isP[i]) primes.push(i);
  }
  return primes;
}

/**
 * Returns all twin prime pairs up to limit as [[p, p+2], ...]
 */
function getTwinPairs(limit) {
  const isP = sieve(limit);
  const pairs = [];
  for (let i = 2; i <= limit - 2; i++) {
    if (isP[i] && isP[i + 2]) {
      pairs.push([i, i + 2]);
    }
  }
  return pairs;
}

/**
 * Returns the set of all numbers that are part of a twin prime pair
 */
function getTwinSet(limit) {
  const pairs = getTwinPairs(limit);
  const set = new Set();
  pairs.forEach(([a, b]) => { set.add(a); set.add(b); });
  return set;
}

/**
 * Prime factorization — returns array of prime factors
 */
function factorize(n) {
  const factors = [];
  let d = 2;
  while (d * d <= n) {
    while (n % d === 0) {
      factors.push(d);
      n = Math.floor(n / d);
    }
    d++;
  }
  if (n > 1) factors.push(n);
  return factors;
}

/**
 * Counts twin prime pairs up to limit
 */
function countTwinPairs(limit) {
  return getTwinPairs(limit).length;
}

/**
 * Hardy-Littlewood estimate for number of twin prime pairs up to N
 * π₂(N) ≈ 2C₂ · N / (ln N)²
 * where C₂ ≈ 0.6601618...  (twin prime constant)
 */
function hardyLittlewoodEstimate(N) {
  if (N < 5) return 0;
  const C2 = 0.6601618158468696;
  return Math.round(2 * C2 * N / Math.pow(Math.log(N), 2));
}

/* ── ULAM SPIRAL ───────────────────────────────────────────────── */

/**
 * Generates Ulam spiral coordinates for numbers 1..n²
 * Returns array of { n, x, y, isPrime, isTwin }
 * Center is at (0,0), coordinates are grid units
 */
function ulamSpiral(size) {
  // size = number of cells per side (should be odd)
  if (size % 2 === 0) size++;
  const total = size * size;
  const isP = sieve(total);
  const twinSet = getTwinSet(total);

  const cells = new Array(total);
  let x = 0, y = 0;
  let dx = 0, dy = -1;
  let n = 1;

  for (let i = 0; i < total; i++) {
    cells[i] = {
      n,
      x,
      y,
      isPrime: isP[n] || false,
      isTwin: twinSet.has(n)
    };
    n++;

    // Turn logic
    if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
      const tmp = dx;
      dx = -dy;
      dy = tmp;
    }
    x += dx;
    y += dy;
  }

  return cells;
}

/**
 * Draws the Ulam spiral onto a canvas element
 * @param {HTMLCanvasElement} canvas
 * @param {number} size  — grid cells per side (odd number, e.g. 51)
 * @param {object} opts  — { showComposite, showPrimes, showTwins, cellSize }
 */
function drawUlamSpiral(canvas, size, opts = {}) {
  const {
    showComposite = false,
    showPrimes = true,
    showTwins = true,
    cellSize = null
  } = opts;

  if (size % 2 === 0) size++;
  const cells = ulamSpiral(size);

  const cs = cellSize || Math.floor(Math.min(canvas.width, canvas.height) / size);
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const offsetX = Math.floor(W / 2);
  const offsetY = Math.floor(H / 2);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#07080C';
  ctx.fillRect(0, 0, W, H);

  cells.forEach(cell => {
    const px = offsetX + cell.x * cs;
    const py = offsetY + cell.y * cs;

    if (cell.isTwin && showTwins) {
      ctx.fillStyle = 'rgba(45, 212, 191, 0.85)';
      ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
    } else if (cell.isPrime && showPrimes) {
      ctx.fillStyle = 'rgba(122, 128, 153, 0.6)';
      ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
    } else if (showComposite) {
      ctx.fillStyle = 'rgba(30, 33, 48, 0.4)';
      ctx.fillRect(px - cs / 2, py - cs / 2, cs - 1, cs - 1);
    }
  });

  // Draw center marker
  ctx.fillStyle = '#F4C542';
  ctx.fillRect(offsetX - 2, offsetY - 2, cs, cs);
}

/* ── PRIME GAP ANALYSIS ────────────────────────────────────────── */

/**
 * Returns array of { prime, gap } objects showing gaps between consecutive primes
 */
function primeGaps(limit) {
  const primes = getPrimes(limit);
  const gaps = [];
  for (let i = 1; i < primes.length; i++) {
    gaps.push({
      prime: primes[i],
      gap: primes[i] - primes[i - 1]
    });
  }
  return gaps;
}

/**
 * Returns gap=2 occurrences (twin prime gaps) up to limit
 */
function twinGaps(limit) {
  return primeGaps(limit).filter(g => g.gap === 2);
}

/* ── PRIME DENSITY ─────────────────────────────────────────────── */

/**
 * Returns twin prime density in each bucket of bucketSize integers
 * Useful for density chart on tools.html
 */
function twinDensity(limit, bucketSize = 100) {
  const isP = sieve(limit);
  const buckets = [];
  for (let start = 2; start < limit; start += bucketSize) {
    const end = Math.min(start + bucketSize - 1, limit);
    let count = 0;
    for (let i = start; i <= end - 2; i++) {
      if (isP[i] && isP[i + 2]) count++;
    }
    buckets.push({ start, end, count });
  }
  return buckets;
}

/* ── EXPORTS (for Node.js pipeline use) ───────────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sieve,
    isPrime,
    isTwinPrime,
    getPrimes,
    getTwinPairs,
    getTwinSet,
    factorize,
    countTwinPairs,
    hardyLittlewoodEstimate,
    ulamSpiral,
    drawUlamSpiral,
    primeGaps,
    twinGaps,
    twinDensity
  };
}
