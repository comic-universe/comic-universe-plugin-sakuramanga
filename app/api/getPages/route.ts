import { NextRequest, NextResponse } from 'next/server'
import { getSakuraChapterPages } from '../../lib/sakura'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const chapterSiteId =
      typeof body?.chapterSiteId === 'string' ? body.chapterSiteId.trim() :
      typeof body?.siteId === 'string' ? body.siteId.trim() :
      ''

    if (!chapterSiteId) {
      return NextResponse.json([])
    }

    return NextResponse.json(await getSakuraChapterPages(chapterSiteId))
  } catch (error) {
    console.error('Error in getPages:', error)
    return NextResponse.json([])
  }
}
