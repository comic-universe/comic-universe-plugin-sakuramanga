import type { Metadata } from 'next'
import { Bangers, Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-roboto'
})

const bangers = Bangers({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bangers'
})

export const metadata: Metadata = {
  title: 'SakuraMangas - Comic Universe Plugin',
  description: 'Plugin for accessing SakuraMangas content in Comic Universe',
  icons: {
    icon: '/icon.png'
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${bangers.variable} antialiased`}>
        <div
          className="fixed inset-0 w-full h-full -z-10"
          style={{
            background:
              'linear-gradient(135deg, #674b9c 0%, #101028 70%, #12182b 90%, #19202c 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        {children}
      </body>
    </html>
  )
}
