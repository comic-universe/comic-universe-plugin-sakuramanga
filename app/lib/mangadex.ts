import { DEFAULT_LANGUAGES, MANGADEX_API_URL, MANGADEX_UPLOADS_URL } from './constants'

type LocalizedMap = Record<string, string>

interface MangaDexRelationship {
  id: string
  type: string
  attributes?: Record<string, unknown>
}

interface MangaDexMangaAttributes {
  title?: LocalizedMap
  description?: LocalizedMap
  status?: string
  availableTranslatedLanguages?: string[]
}

interface MangaDexMangaData {
  id: string
  attributes?: MangaDexMangaAttributes
  relationships?: MangaDexRelationship[]
}

interface MangaDexChapterAttributes {
  chapter?: string | null
  title?: string | null
  translatedLanguage?: string | null
}

interface MangaDexChapterData {
  id: string
  attributes?: MangaDexChapterAttributes
}

interface MangaDexListResponse<T> {
  data?: T[]
  total?: number
}

interface MangaDexAggregateResponse {
  volumes?: Record<
    string,
    {
      chapters?: Record<string, unknown>
    }
  >
}

const pickLocalized = (value: LocalizedMap | undefined): string => {
  if (!value || typeof value !== 'object') return ''
  const preferred = value.en
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
  const first = Object.values(value).find((entry) => typeof entry === 'string' && entry.trim())
  return typeof first === 'string' ? first.trim() : ''
}

const normalizeStatus = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'Unknown'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'ongoing') return 'Em andamento'
  if (normalized === 'completed') return 'Concluido'
  if (normalized === 'hiatus') return 'Hiato'
  if (normalized === 'cancelled') return 'Cancelado'
  return value.trim()
}

const normalizeLanguageCodes = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const resolveRequestedLanguages = (value: unknown): string[] => {
  const requested = normalizeLanguageCodes(value)
  if (requested.length > 0) return requested
  return DEFAULT_LANGUAGES
}

const extractCoverFileName = (relationships: MangaDexRelationship[] | undefined): string => {
  if (!Array.isArray(relationships)) return ''
  const cover = relationships.find((relationship) => relationship.type === 'cover_art')
  if (!cover?.attributes) return ''
  const fileName = cover.attributes.fileName
  return typeof fileName === 'string' ? fileName : ''
}

const buildCoverUrl = (mangaId: string, fileName: string): string => {
  if (!mangaId || !fileName) return ''
  return `${MANGADEX_UPLOADS_URL}/covers/${mangaId}/${fileName}`
}

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

export async function searchMangaDexManga(
  query: string,
  limit = 25,
  languageCodes?: string[]
): Promise<PluginMangaSummary[]> {
  const params = new URLSearchParams()
  params.set('title', query)
  params.set('limit', String(Math.max(1, Math.min(limit, 100))))
  params.append('includes[]', 'cover_art')
  params.append('order[relevance]', 'desc')
  for (const language of resolveRequestedLanguages(languageCodes)) {
    params.append('availableTranslatedLanguage[]', language)
  }

  const response = await fetch(`${MANGADEX_API_URL}/manga?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`MangaDex search failed (${response.status})`)
  }

  const payload = (await response.json()) as MangaDexListResponse<MangaDexMangaData>
  const rows = Array.isArray(payload.data) ? payload.data : []

  return rows.map((manga) => {
    const title = pickLocalized(manga.attributes?.title) || manga.id
    const synopsis = pickLocalized(manga.attributes?.description)
    const status = normalizeStatus(manga.attributes?.status)
    const coverFileName = extractCoverFileName(manga.relationships)
    const cover = buildCoverUrl(manga.id, coverFileName)

    return {
      siteId: manga.id,
      name: title,
      synopsis,
      status,
      cover,
      chapterCount: null,
      languageCodes: normalizeLanguageCodes(manga.attributes?.availableTranslatedLanguages),
      contentType: 'manga'
    }
  })
}

export async function getMangaDexMangaDetails(
  siteId: string,
  languageCodes?: string[]
): Promise<PluginMangaSummary | null> {
  const params = new URLSearchParams()
  params.append('includes[]', 'cover_art')

  const response = await fetch(`${MANGADEX_API_URL}/manga/${siteId}?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`MangaDex getDetails failed (${response.status})`)
  }

  const payload = (await response.json()) as { data?: MangaDexMangaData }
  const manga = payload.data
  if (!manga) return null

  const title = pickLocalized(manga.attributes?.title) || manga.id
  const synopsis = pickLocalized(manga.attributes?.description)
  const status = normalizeStatus(manga.attributes?.status)
  const coverFileName = extractCoverFileName(manga.relationships)
  const cover = buildCoverUrl(manga.id, coverFileName)
  const chapterCount = await getMangaDexChapterCount(siteId, languageCodes)

  return {
    siteId: manga.id,
    name: title,
    synopsis,
    status,
    cover,
    chapterCount,
    languageCodes: normalizeLanguageCodes(manga.attributes?.availableTranslatedLanguages),
    contentType: 'manga'
  }
}

async function getMangaDexChapterCount(siteId: string, languageCodes?: string[]): Promise<number> {
  const params = new URLSearchParams()
  for (const language of resolveRequestedLanguages(languageCodes)) {
    params.append('translatedLanguage[]', language)
  }

  const response = await fetch(`${MANGADEX_API_URL}/manga/${siteId}/aggregate?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    return 0
  }

  const payload = (await response.json()) as MangaDexAggregateResponse
  const volumes = payload.volumes ?? {}

  let total = 0
  for (const volume of Object.values(volumes)) {
    total += Object.keys(volume?.chapters ?? {}).length
  }

  return total
}

export async function getMangaDexChapters(
  siteId: string,
  languageCodes?: string[]
): Promise<PluginChapterSummary[]> {
  const limit = 100
  let offset = 0
  let total = 0
  const chapters: MangaDexChapterData[] = []

  do {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    params.append('order[chapter]', 'asc')
    params.append('order[volume]', 'asc')
    for (const language of resolveRequestedLanguages(languageCodes)) {
      params.append('translatedLanguage[]', language)
    }

    const response = await fetch(`${MANGADEX_API_URL}/manga/${siteId}/feed?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })

    if (!response.ok) {
      throw new Error(`MangaDex getChapters failed (${response.status})`)
    }

    const payload = (await response.json()) as MangaDexListResponse<MangaDexChapterData>
    const pageData = Array.isArray(payload.data) ? payload.data : []
    total = typeof payload.total === 'number' ? payload.total : 0
    chapters.push(...pageData)
    offset += limit
  } while (offset < total && offset < 1000)

  return chapters.map((chapter, index) => {
    const number = chapter.attributes?.chapter?.trim() || String(index + 1)
    const chapterTitle = chapter.attributes?.title?.trim()
    const name = chapterTitle ? `Cap. ${number} - ${chapterTitle}` : `Cap. ${number}`
    const language = chapter.attributes?.translatedLanguage?.trim() || 'unknown'

    return {
      siteId: chapter.id,
      name,
      number,
      language,
      languageCodes: [language],
      offline: false,
      pages: []
    }
  })
}

export async function getMangaDexChapterPages(chapterSiteId: string): Promise<PluginPage[]> {
  const response = await fetch(`${MANGADEX_API_URL}/at-home/server/${chapterSiteId}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`MangaDex getPages failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    baseUrl?: string
    chapter?: { hash?: string; data?: string[] }
  }

  const baseUrl = typeof payload.baseUrl === 'string' ? payload.baseUrl : ''
  const hash = typeof payload.chapter?.hash === 'string' ? payload.chapter.hash : ''
  const files = Array.isArray(payload.chapter?.data) ? payload.chapter?.data : []

  if (!baseUrl || !hash || files.length === 0) {
    return []
  }

  return files.map((fileName) => ({
    filename: fileName,
    path: `${baseUrl}/data/${hash}/${fileName}`
  }))
}
