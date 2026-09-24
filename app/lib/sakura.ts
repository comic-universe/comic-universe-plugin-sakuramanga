import * as cheerio from 'cheerio'

const SAKURA_BASE_URL = (process.env.SAKURA_BASE_URL || 'https://sakuramangas.org').replace(/\/+$/, '')
const DEFAULT_LANGUAGES = ['pt-br', 'pt', 'en']

const USER_AGENT =
  process.env.SAKURA_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

const SAKURA_COOKIE = process.env.SAKURA_COOKIE || ''
const SAKURA_PHPSESSID = process.env.SAKURA_PHPSESSID || ''
const SAKURA_CF_CLEARANCE = process.env.SAKURA_CF_CLEARANCE || ''
const SAKURA_CSRF_TOKEN = process.env.SAKURA_CSRF_TOKEN || ''
const SAKURA_CLIENT_SIGNATURE = process.env.SAKURA_CLIENT_SIGNATURE || ''
const SAKURA_VERIFICATION_KEY_1 = process.env.SAKURA_VERIFICATION_KEY_1 || ''
const SAKURA_VERIFICATION_KEY_2 = process.env.SAKURA_VERIFICATION_KEY_2 || ''
const SAKURA_PROOF = process.env.SAKURA_PROOF || ''
const SAKURA_CHALLENGE = process.env.SAKURA_CHALLENGE || ''

const REQUIRED_COOKIE_PATTERNS = [/(?:^|;\s*)PHPSESSID=/i, /(?:^|;\s*)cf_clearance=/i]
const SECURITY_CACHE_TTL_MS = 5 * 60 * 1000
const COOKIE_CACHE_TTL_MS = 30 * 60 * 1000

interface SakuraRuntimeSecurity {
  csrfToken?: string
  clientSignature?: string
  verificationKey1?: string
  verificationKey2?: string
  proof?: string
  challenge?: string
}

let runtimeSecurityCache: { expiresAt: number; value: SakuraRuntimeSecurity } | null = null
let runtimeCookieCache: { expiresAt: number; value: string } | null = null

export interface PluginMangaSummary {
  siteId: string
  name: string
  synopsis: string
  status: string
  cover: string
  chapterCount: number | null
  languageCodes: string[]
  contentType: 'manga'
}

export interface PluginChapterSummary {
  siteId: string
  siteLink?: string
  name: string
  number: string
  language: string
  languageCodes: string[]
  offline: boolean
  pages: Array<Record<string, unknown>>
}

export interface PluginPage {
  filename: string
  path: string
}

const toAbsolute = (value: string | null | undefined): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `${SAKURA_BASE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
}

const resolveLanguages = (value?: string[]): string[] => {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_LANGUAGES
  return value
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

const baseHeaders = (): Record<string, string> => {
  const cookie = getSakuraCookie()
  const headers: Record<string, string> = {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6',
    priority: 'u=1, i',
    'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': USER_AGENT,
    'x-requested-with': 'XMLHttpRequest',
    referer: `${SAKURA_BASE_URL}/`
  }
  if (cookie) {
    headers.cookie = cookie
  }
  return headers
}

const protectedHeaders = (security: SakuraRuntimeSecurity): Record<string, string> => {
  const headers: Record<string, string> = {
    ...baseHeaders(),
    accept: '*/*',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    origin: SAKURA_BASE_URL
  }

  if (security.clientSignature) headers['x-client-signature'] = security.clientSignature
  if (security.csrfToken) headers['x-csrf-token'] = security.csrfToken
  if (security.verificationKey1) headers['x-verification-key-1'] = security.verificationKey1
  if (security.verificationKey2) headers['x-verification-key-2'] = security.verificationKey2

  return headers
}

const parseCookiePairs = (cookieHeader: string): Map<string, string> => {
  const pairs = new Map<string, string>()
  cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const idx = entry.indexOf('=')
      if (idx <= 0) return
      const key = entry.slice(0, idx).trim()
      const value = entry.slice(idx + 1).trim()
      if (!key || !value) return
      pairs.set(key, value)
    })
  return pairs
}

const extractSetCookieHeaders = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const combined = response.headers.get('set-cookie')
  if (!combined) return []
  return combined
    .split(/,(?=\s*[a-zA-Z0-9_-]+=)/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const cacheCookiesFromResponse = (response: Response): void => {
  const setCookies = extractSetCookieHeaders(response)
  if (setCookies.length === 0) return

  const existing = parseCookiePairs(
    runtimeCookieCache?.expiresAt && runtimeCookieCache.expiresAt > Date.now() ? runtimeCookieCache.value : ''
  )
  for (const setCookie of setCookies) {
    const firstPart = setCookie.split(';')[0]?.trim()
    if (!firstPart) continue
    const idx = firstPart.indexOf('=')
    if (idx <= 0) continue
    const key = firstPart.slice(0, idx).trim()
    const value = firstPart.slice(idx + 1).trim()
    if (!key || !value) continue
    existing.set(key, value)
  }

  const merged = Array.from(existing.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
    .trim()
  if (!merged) return

  runtimeCookieCache = {
    expiresAt: Date.now() + COOKIE_CACHE_TTL_MS,
    value: merged
  }
}

const getSakuraCookie = (): string => {
  const merged = new Map<string, string>()

  if (SAKURA_COOKIE.trim()) {
    for (const [k, v] of parseCookiePairs(SAKURA_COOKIE.trim())) merged.set(k, v)
  } else {
    if (SAKURA_PHPSESSID.trim()) merged.set('PHPSESSID', SAKURA_PHPSESSID.trim())
    if (SAKURA_CF_CLEARANCE.trim()) merged.set('cf_clearance', SAKURA_CF_CLEARANCE.trim())
  }

  if (runtimeCookieCache && runtimeCookieCache.expiresAt > Date.now()) {
    for (const [k, v] of parseCookiePairs(runtimeCookieCache.value)) {
      if (!merged.has(k)) merged.set(k, v)
    }
  }

  return Array.from(merged.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

const hasRequiredCookie = (cookie = getSakuraCookie()): boolean => {
  return REQUIRED_COOKIE_PATTERNS.every((pattern) => pattern.test(cookie))
}

const assertSakuraSession = async (scope: 'search' | 'protected'): Promise<void> => {
  const cookie = getSakuraCookie()
  if (scope === 'search') {
    // Search can work without a full session depending on current Cloudflare policy.
    return
  }

  if (!cookie || !hasRequiredCookie()) {
    await getRuntimeSecurity(true)
  }

  const refreshedCookie = getSakuraCookie()
  if (!refreshedCookie || !hasRequiredCookie(refreshedCookie)) {
    throw new Error(
      'Sakura session is missing or invalid. Set SAKURA_COOKIE with both PHPSESSID and cf_clearance.'
    )
  }
}

const firstRegexMatch = (text: string, patterns: RegExp[]): string => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

const collectRuntimeSecurity = (text: string, seed: SakuraRuntimeSecurity): SakuraRuntimeSecurity => {
  const next = { ...seed }

  if (!next.csrfToken) {
    next.csrfToken = firstRegexMatch(text, [
      /<meta[^>]*name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i,
      /\bx-csrf-token["']?\s*[:=]\s*["']([^"']+)["']/i
    ])
  }
  if (!next.clientSignature) {
    next.clientSignature = firstRegexMatch(text, [
      /\bx-client-signature["']?\s*[:=]\s*["']([^"']+)["']/i,
      /\b([A-Z0-9]{5}(?:-[A-Z0-9]{5}){2})\b/
    ])
  }
  if (!next.verificationKey1) {
    next.verificationKey1 = firstRegexMatch(text, [
      /\bx-verification-key-1["']?\s*[:=]\s*["']([^"']+)["']/i
    ])
  }
  if (!next.verificationKey2) {
    next.verificationKey2 = firstRegexMatch(text, [
      /\bx-verification-key-2["']?\s*[:=]\s*["']([^"']+)["']/i
    ])
  }
  if (!next.proof) {
    next.proof = firstRegexMatch(text, [/\bproof["']?\s*[:=]\s*["']([a-f0-9]{32})["']/i])
  }
  if (!next.challenge) {
    next.challenge = firstRegexMatch(text, [
      /\bchallenge["']?\s*[:=]\s*["']([^"']{40,})["']/i,
      /\bchallenge=([^&"'\\\s]{40,})/i
    ])
  }

  // Fallback for verification keys when obfuscated scripts hide the header names.
  const genericKeyMatches = Array.from(text.matchAll(/\b([a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9-]{20,})\b/gi))
    .map((entry) => entry[1])
    .filter(Boolean)
  if (!next.verificationKey1 && genericKeyMatches.length > 0) next.verificationKey1 = genericKeyMatches[0]
  if (!next.verificationKey2 && genericKeyMatches.length > 1) next.verificationKey2 = genericKeyMatches[1]

  return next
}

const getRuntimeSecurity = async (forceRefresh = false): Promise<SakuraRuntimeSecurity> => {
  const now = Date.now()
  if (!forceRefresh && runtimeSecurityCache && runtimeSecurityCache.expiresAt > now) {
    return runtimeSecurityCache.value
  }

  let security: SakuraRuntimeSecurity = {}
  const homeResponse = await fetch(`${SAKURA_BASE_URL}/`, {
    method: 'GET',
    headers: {
      ...baseHeaders(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  })

  if (homeResponse.ok) {
    cacheCookiesFromResponse(homeResponse)
    const html = await homeResponse.text()
    security = collectRuntimeSecurity(html, security)

    const $ = cheerio.load(html)
    const scriptUrls = $('script[src]')
      .map((_, element) => String($(element).attr('src') || '').trim())
      .get()
      .filter(Boolean)
      .map((src) => toAbsolute(src))
      .filter(Boolean)
      .slice(0, 10)

    for (const scriptUrl of scriptUrls) {
      try {
        const scriptRes = await fetch(scriptUrl, {
          method: 'GET',
          headers: {
            ...baseHeaders(),
            accept: '*/*'
          }
        })
        if (!scriptRes.ok) continue
        cacheCookiesFromResponse(scriptRes)
        const scriptText = await scriptRes.text()
        security = collectRuntimeSecurity(scriptText, security)
      } catch {
        // Best-effort runtime discovery.
      }
    }
  }

  runtimeSecurityCache = {
    expiresAt: now + SECURITY_CACHE_TTL_MS,
    value: security
  }
  return security
}

const resolveSecurity = async (forceRefresh = false): Promise<SakuraRuntimeSecurity> => {
  const runtime = await getRuntimeSecurity(forceRefresh)
  return {
    csrfToken: SAKURA_CSRF_TOKEN || runtime.csrfToken,
    clientSignature: SAKURA_CLIENT_SIGNATURE || runtime.clientSignature,
    verificationKey1: SAKURA_VERIFICATION_KEY_1 || runtime.verificationKey1,
    verificationKey2: SAKURA_VERIFICATION_KEY_2 || runtime.verificationKey2,
    proof: SAKURA_PROOF || runtime.proof,
    challenge: SAKURA_CHALLENGE || runtime.challenge
  }
}

const postProtected = async <T>(
  endpoint: string,
  payload: Record<string, string | number>
): Promise<T> => {
  await assertSakuraSession('protected')
  const body = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => body.set(key, String(value)))
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const security = attempt === 0 ? await resolveSecurity() : await resolveSecurity(true)
    const requestBody = new URLSearchParams(body.toString())
    if (!requestBody.get('proof') && security.proof) requestBody.set('proof', security.proof)
    if (!requestBody.get('challenge') && security.challenge) requestBody.set('challenge', security.challenge)

    const missing: string[] = []
    if (!security.csrfToken) missing.push('SAKURA_CSRF_TOKEN')
    if (!security.clientSignature) missing.push('SAKURA_CLIENT_SIGNATURE')
    if (!security.verificationKey1) missing.push('SAKURA_VERIFICATION_KEY_1')
    if (!security.verificationKey2) missing.push('SAKURA_VERIFICATION_KEY_2')
    if (!requestBody.get('proof')) missing.push('SAKURA_PROOF')
    if (!requestBody.get('challenge')) missing.push('SAKURA_CHALLENGE')
    if (missing.length > 0) {
      throw new Error(
        `Sakura runtime security bootstrap incomplete. Missing: ${missing.join(
          ', '
        )}. Keep env overrides or refresh session/cookies.`
      )
    }

    const response = await fetch(`${SAKURA_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: protectedHeaders(security),
      body: requestBody
    })
    cacheCookiesFromResponse(response)

    if (response.ok) {
      return (await response.json()) as T
    }

    if (attempt === 0 && response.status === 403) {
      continue
    }

    throw new Error(
      `Sakura request failed (${response.status}) at ${endpoint}. Refresh SAKURA_COOKIE/SAKURA_* challenge tokens.`
    )
  }

  throw new Error(`Sakura request failed at ${endpoint} after runtime retry.`)
}

const normalizeStatus = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'Unknown'
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('andamento')) return 'Em andamento'
  if (normalized.includes('concl')) return 'Concluido'
  if (normalized.includes('hiato')) return 'Hiato'
  if (normalized.includes('cancel')) return 'Cancelado'
  return value.trim()
}

export async function searchSakuraManga(
  query: string,
  _limit = 25,
  languageCodes?: string[]
): Promise<PluginMangaSummary[]> {
  const performSearch = () =>
    fetch(`${SAKURA_BASE_URL}/dist/sakura/global/sidebar/sidebar.php?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        ...baseHeaders()
      }
    })

  let response = await performSearch()
  cacheCookiesFromResponse(response)
  if (response.status === 403) {
    await getRuntimeSecurity(true)
    response = await performSearch()
    cacheCookiesFromResponse(response)
  }

  if (!response.ok) {
    if (response.status === 403) {
      return []
    }
    throw new Error(`Sakura search failed (${response.status}).`)
  }

  const payload = (await response.json()) as Array<Record<string, unknown>>

  return payload.map((item) => {
    const chapterCountRaw = item.ultimo_capitulo
    const chapterCount =
      typeof chapterCountRaw === 'number'
        ? chapterCountRaw
        : typeof chapterCountRaw === 'string' && chapterCountRaw.trim()
          ? Number(chapterCountRaw)
          : null

    return {
      siteId: String(item.id ?? ''),
      name: String(item.titulo ?? ''),
      synopsis: '',
      status: normalizeStatus(item.status),
      cover: toAbsolute(typeof item.thumb_url === 'string' ? item.thumb_url : ''),
      chapterCount: Number.isFinite(chapterCount) ? chapterCount : null,
      languageCodes: resolveLanguages(languageCodes),
      contentType: 'manga'
    }
  })
}

export async function getSakuraMangaDetails(
  mangaId: string,
  languageCodes?: string[]
): Promise<PluginMangaSummary | null> {
  const payload = await postProtected<Record<string, unknown>>(
    '/dist/sakura/models/manga/.__obf__manga_info.php',
    { manga_id: mangaId }
  )

  if (!payload || typeof payload !== 'object') {
    return null
  }

  const chapterCountRaw = payload.ultimo_capitulo
  const chapterCount =
    typeof chapterCountRaw === 'number'
      ? chapterCountRaw
      : typeof chapterCountRaw === 'string' && chapterCountRaw.trim()
        ? Number(chapterCountRaw)
        : null

  return {
    siteId: mangaId,
    name: String(payload.titulo ?? mangaId),
    synopsis: String(payload.sinopse ?? ''),
    status: normalizeStatus(payload.status),
    cover: toAbsolute(
      typeof payload.primeiro_capitulo_url === 'string'
        ? payload.primeiro_capitulo_url.replace(/\/[^/]+$/, '/thumb_256.jpg')
        : ''
    ),
    chapterCount: Number.isFinite(chapterCount) ? chapterCount : null,
    languageCodes: resolveLanguages(languageCodes),
    contentType: 'manga'
  }
}

interface SakuraChaptersResponse {
  success?: boolean
  has_more?: boolean
  data?: Array<{
    numero?: number | string
    versoes?: Array<{
      titulo?: string | null
      url?: string
      id?: number | string
    }>
  }>
}

export async function getSakuraChapters(
  mangaId: string,
  languageCodes?: string[]
): Promise<PluginChapterSummary[]> {
  const all: PluginChapterSummary[] = []
  const limit = 50
  let offset = 0

  while (true) {
    const payload = await postProtected<SakuraChaptersResponse>(
      '/dist/sakura/models/manga/.__obf__manga_capitulos.php',
      {
        manga_id: mangaId,
        offset,
        order: 'desc',
        limit
      }
    )

    const groups = Array.isArray(payload.data) ? payload.data : []
    for (const group of groups) {
      const chapterNumber = String(group.numero ?? '').trim()
      const versions = Array.isArray(group.versoes) ? group.versoes : []
      for (const version of versions) {
        const chapterPath = typeof version.url === 'string' ? version.url : ''
        if (!chapterPath) continue
        const chapterTitle = typeof version.titulo === 'string' ? version.titulo.trim() : ''
        const name = chapterTitle ? `Cap. ${chapterNumber} - ${chapterTitle}` : `Cap. ${chapterNumber}`

        all.push({
          siteId: chapterPath,
          siteLink: toAbsolute(chapterPath),
          name,
          number: chapterNumber,
          language: 'pt-br',
          languageCodes: resolveLanguages(languageCodes),
          offline: false,
          pages: []
        })
      }
    }

    if (!payload.has_more || groups.length === 0) {
      break
    }

    offset += limit
    if (offset > 3000) break
  }

  return all
}

export async function getSakuraChapterPages(chapterSiteId: string): Promise<PluginPage[]> {
  const chapterUrl = toAbsolute(chapterSiteId)
  if (!chapterUrl) return []

  const response = await fetch(chapterUrl, {
    method: 'GET',
    headers: {
      ...baseHeaders(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  })

  if (!response.ok) {
    throw new Error(`Sakura getPages failed (${response.status})`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const candidates: string[] = []
  const selectors = [
    '#reader img',
    '.reader img',
    '.chapter-reader img',
    '.paginas img',
    '.pagina img',
    'img[data-src]',
    'img[src]'
  ]

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const src =
        ($(element).attr('data-src') || $(element).attr('data-lazy-src') || $(element).attr('src') || '').trim()
      if (!src) return
      const absolute = toAbsolute(src)
      if (!absolute) return
      if (!/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(absolute)) return
      candidates.push(absolute)
    })
    if (candidates.length > 0) break
  }

  const unique = Array.from(new Set(candidates))
  return unique.map((path, index) => ({
    filename: `page-${index + 1}${path.match(/\.(jpg|jpeg|png|webp|avif)(\?|$)/i)?.[0] || '.jpg'}`,
    path
  }))
}
