#!/usr/bin/env node

/**
 * Incrementa automáticamente la versión del Service Worker
 * Uso: node scripts/bump-sw-version.js
 * 
 * Lee sw.js, extrae la versión (v28 -> 28), la incrementa (v29),
 * y actualiza ambas líneas CACHE_NAME y STATIC_CACHE.
 */

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../sw.js');

try {
  const content = fs.readFileSync(swPath, 'utf-8');
  
  // Extraer versión actual: "bendito-lab-v28" -> 28
  const match = content.match(/bendito-lab-v(\d+)/);
  if (!match) {
    console.error('❌ No se encontró versión en sw.js');
    process.exit(1);
  }
  
  const currentVersion = parseInt(match[1], 10);
  const newVersion = currentVersion + 1;
  
  // Reemplazar ambas líneas (CACHE_NAME y STATIC_CACHE)
  const updated = content
    .replace(
      new RegExp(`bendito-lab-v${currentVersion}`, 'g'),
      `bendito-lab-v${newVersion}`
    )
    .replace(
      new RegExp(`bendito-static-v${currentVersion}`, 'g'),
      `bendito-static-v${newVersion}`
    );
  
  fs.writeFileSync(swPath, updated);
  console.log(`✅ SW versionado: v${currentVersion} → v${newVersion}`);
  
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
