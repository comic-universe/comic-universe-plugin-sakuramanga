import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in downloadChapter:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
