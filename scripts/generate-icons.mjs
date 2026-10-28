import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'node:fs'
mkdirSync('public/icons', { recursive: true })
const svg = readFileSync('public/favicon.svg')
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#4f46e5"/><g transform="translate(76 76) scale(0.7)" fill="#fff"><rect x="96" y="216" width="40" height="80" rx="10"/><rect x="376" y="216" width="40" height="80" rx="10"/><rect x="64" y="236" width="24" height="40" rx="8"/><rect x="424" y="236" width="24" height="40" rx="8"/><rect x="136" y="244" width="240" height="24" rx="8"/></g></svg>`)
await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png')
await sharp(svg).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
await sharp(maskable).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
console.log('icons ok')
