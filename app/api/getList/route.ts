import { NextRequest, NextResponse } from 'next/server'
import { searchSakuraManga } from '../../lib/sakura'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { languageCodes?: string[]; search?: string }
    const seedQuery = typeof body.search === 'string' && body.search.trim() ? body.search.trim() : 'one piece'
    return NextResponse.json(await searchSakuraManga(seedQuery, 40, body.languageCodes))
  } catch (error) {
    console.error('Error in getList:', error)
    return NextResponse.json([])
  }
}
