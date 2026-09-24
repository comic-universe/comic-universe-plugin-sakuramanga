import { NextRequest, NextResponse } from 'next/server'
import { getSakuraChapters } from '../../lib/sakura'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const siteId = typeof body?.siteId === 'string' ? body.siteId.trim() : ''
    const languageCodes = Array.isArray(body?.languageCodes) ? body.languageCodes : undefined

    if (!siteId) {
      return NextResponse.json([])
    }

    return NextResponse.json(await getSakuraChapters(siteId, languageCodes))
  } catch (error) {
    console.error('Error in getChapters:', error)
    return NextResponse.json([])
  }
}
