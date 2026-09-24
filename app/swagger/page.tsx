'use client'

import { useEffect } from 'react'

export default function SwaggerPage() {
  useEffect(() => {
    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'
    document.head.appendChild(stylesheet)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'
    script.async = true

    script.onload = () => {
      const swaggerBundle = (
        window as typeof window & { SwaggerUIBundle?: (config: Record<string, unknown>) => void }
      ).SwaggerUIBundle

      if (swaggerBundle) {
        swaggerBundle({
          url: '/api/openapi',
          dom_id: '#swagger-ui',
          deepLinking: true,
          layout: 'BaseLayout'
        })
      }
    }

    document.body.appendChild(script)

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
      if (stylesheet.parentNode) stylesheet.parentNode.removeChild(stylesheet)
    }
  }, [])

  return (
    <div className="relative z-10 min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-bangers text-yellow-400 text-4xl mb-4">Swagger</h1>
        <p className="text-white/80 mb-6">MangaDex plugin API documentation.</p>
        <div className="bg-white rounded-xl p-4">
          <div id="swagger-ui" />
        </div>
      </div>
    </div>
  )
}
