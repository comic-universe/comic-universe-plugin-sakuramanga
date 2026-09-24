'use client'

import { useState } from 'react'
import Image from 'next/image'
import StarrySky from './components/StarrySky'

export default function Home() {
  const [installStatus, setInstallStatus] = useState<string>('')

  const handleInstall = () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const pluginUrl = `${baseUrl}/api`
      const metadataUrl = `${pluginUrl}/metadata`
      const pluginName = 'SakuraMangas'
      const pluginTag = 'sakuramangas'

      const deepLink = `comic-universe-tauri://plugin/install?url=${encodeURIComponent(
        pluginUrl
      )}&metadataUrl=${encodeURIComponent(metadataUrl)}&name=${encodeURIComponent(
        pluginName
      )}&tag=${encodeURIComponent(pluginTag)}`

      setInstallStatus('Opening Comic Universe...')
      window.location.href = deepLink

      setTimeout(() => {
        setInstallStatus(
          'If Comic Universe did not open, make sure it is installed and set as the default handler for comic-universe:// links.'
        )
      }, 2000)
    } catch (error) {
      console.error('Error creating deep link:', error)
      setInstallStatus('Error: Could not create install link. Please check the console.')
    }
  }

  return (
    <div className="relative w-full min-h-screen">
      <StarrySky className="fixed inset-0 w-full h-full -z-0" />
      <section className="relative z-10 flex flex-col items-center min-h-screen px-6 py-12">
        <div className="text-center mb-6 max-w-4xl">
          <div className="flex justify-center mb-2">
            <Image
              src="/icon.svg"
              alt="SakuraMangas Logo"
              className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80"
              width={320}
              height={320}
            />
          </div>
          <h1
            className="font-bangers text-yellow-400 text-3xl md:text-4xl mb-3"
            style={{
              textShadow:
                '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 2px 0px #000, 0px -2px 0px #000, 2px 0px 0px #000, -2px 0px 0px #000'
            }}
          >
            SakuraMangas
          </h1>
          <p className="text-white text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-6">
            Search and import manga from SakuraMangas directly in Comic Universe.
          </p>
        </div>

        <div className="bg-purple-900/40 backdrop-blur-sm rounded-2xl p-8 md:p-12 max-w-4xl mx-auto border border-purple-500/30 w-full">
          <div className="text-center mb-8">
            <h2
              className="font-bangers text-yellow-400 text-3xl md:text-4xl mb-4"
              style={{
                textShadow:
                  '2px 2px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 0px 2px 0px #000, 0px -2px 0px #000, 2px 0px 0px #000, -2px 0px 0px #000'
              }}
            >
              API Endpoints
            </h2>
            <p className="text-white/80 text-lg mb-6">
              This plugin uses SakuraMangas private endpoints through backend proxy:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {['getList', 'search', 'getDetails', 'getChapters', 'getPages', 'downloadChapter'].map((endpoint) => (
              <div key={endpoint} className="bg-purple-900/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-white text-lg font-semibold mb-2">{endpoint}</h3>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleInstall}
              className="font-light bg-yellow-400 hover:bg-yellow-500 text-black shadow-lg px-8 py-4 rounded-lg text-lg transition-colors flex items-center justify-center gap-3 cursor-pointer w-full md:w-auto"
            >
              Install Plugin
            </button>
            <a
              href="/swagger"
              className="font-light bg-purple-600/80 hover:bg-purple-500 text-white shadow-lg px-8 py-4 rounded-lg text-lg transition-colors w-full md:w-auto text-center"
            >
              Open Swagger
            </a>
            {installStatus && (
              <p className="text-white/80 text-sm text-center max-w-md">{installStatus}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
