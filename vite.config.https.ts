import { defineConfig, mergeConfig } from 'vite'
import { readFileSync } from 'node:fs'
import baseConfig from './vite.config'

export default defineConfig(({ command }) => {
  // Builds do not need access to development credentials.
  if (command !== 'serve') return baseConfig

  const keyPath = process.env.DEV_HTTPS_KEY_PATH
  const certPath = process.env.DEV_HTTPS_CERT_PATH
  if (Boolean(keyPath) !== Boolean(certPath)) {
    throw new Error('Set both DEV_HTTPS_KEY_PATH and DEV_HTTPS_CERT_PATH. See docs/development.md.')
  }

  let key: Buffer
  let cert: Buffer
  try {
    key = readFileSync(keyPath || '.cert/localhost-key.pem')
    cert = readFileSync(certPath || '.cert/localhost-cert.pem')
  } catch {
    throw new Error('Cannot read development TLS credentials. Generate local certificates or set DEV_HTTPS_KEY_PATH and DEV_HTTPS_CERT_PATH. See docs/development.md.')
  }

  return mergeConfig(baseConfig, {
    server: {
      host: '127.0.0.1',
      https: { key, cert },
    },
  })
})
