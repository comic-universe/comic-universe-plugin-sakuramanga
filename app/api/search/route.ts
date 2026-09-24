import { NextRequest, NextResponse } from 'next/server'
import { searchSakuraManga } from '../../lib/sakura'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { search, languageCodes } = body as { search?: string; languageCodes?: string[] }

    if (!search) {
      return NextResponse.json([])
    }

    return NextResponse.json(await searchSakuraManga(String(search), 25, languageCodes))
  } catch (error) {
    console.error('Error in search:', error)
    return NextResponse.json([])
  }
}
