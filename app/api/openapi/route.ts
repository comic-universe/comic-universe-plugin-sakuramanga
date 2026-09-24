import { NextResponse } from 'next/server'

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Comic Universe Plugin - SakuraMangas API',
    version: '2.0.0',
    description: 'HTTP API exposed by the SakuraMangas plugin for Comic Universe.'
  },
  servers: [{ url: '/' }],
  paths: {
    '/api/getList': { post: { summary: 'Get default manga list', responses: { '200': { description: 'OK' } } } },
    '/api/search': {
      post: {
        summary: 'Search manga by name',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { search: { type: 'string' } } } } }
        },
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/getDetails': {
      post: {
        summary: 'Get manga details',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { siteId: { type: 'string' } } } } }
        },
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/getChapters': {
      post: {
        summary: 'Get manga chapters',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { siteId: { type: 'string' } } } } }
        },
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/getPages': {
      post: {
        summary: 'Get chapter pages',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { chapterSiteId: { type: 'string' }, siteId: { type: 'string' } } }
            }
          }
        },
        responses: { '200': { description: 'OK' } }
      }
    },
    '/api/downloadChapter': {
      post: {
        summary: 'Download chapter stub',
        responses: { '200': { description: 'OK' } }
      }
    }
  }
}

export async function GET() {
  return NextResponse.json(openApiDocument)
}
