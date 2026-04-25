#!/usr/bin/env node

/**
 * Script para monitorear el despliegue del backend en Render
 * Verifica periódicamente si el git hash coincide con el esperado
 *
 * Uso: node monitor-deployment.js [expectedHash] [interval]
 * Ejemplo: node monitor-deployment.js fe9d376 15000
 */

const EXPECTED_HASH = process.argv[2] || 'fe9d376';
const CHECK_INTERVAL = parseInt(process.argv[3]) || 15000; // 15 segundos
const BACKEND_URL = 'https://wahu-backend.onrender.com/api/health';

let checkCount = 0;
let lastHash = null;

async function checkDeployment() {
  checkCount++;

  try {
    const response = await fetch(BACKEND_URL);
    const data = await response.json();
    const currentHash = data.gitHash;
    const timestamp = new Date().toLocaleTimeString();

    // Mostrar cambios
    if (currentHash !== lastHash) {
      console.log(`[${timestamp}] Backend hash: ${currentHash || 'unknown'}`);
      lastHash = currentHash;
    }

    // Verificar si coincide
    if (currentHash === EXPECTED_HASH) {
      console.log('\n✅ ✅ ✅ DESPLIEGUE COMPLETADO ✅ ✅ ✅');
      console.log(`Expected: ${EXPECTED_HASH}`);
      console.log(`Current:  ${currentHash}`);
      console.log(`Checks:   ${checkCount}`);
      process.exit(0);
    }
  } catch (err) {
    console.log(`[${new Date().toLocaleTimeString()}] ⏳ Esperando despliegue... (Check ${checkCount})`);
  }
}

console.log('🔍 Monitoreando despliegue del backend...');
console.log(`📍 URL: ${BACKEND_URL}`);
console.log(`⏱️  Intervalo: ${CHECK_INTERVAL}ms`);
console.log(`🎯 Hash esperado: ${EXPECTED_HASH}`);
console.log('---');

// Primer check inmediato
checkDeployment();

// Checks posteriores
const interval = setInterval(checkDeployment, CHECK_INTERVAL);

// Timeout después de 10 minutos
setTimeout(() => {
  clearInterval(interval);
  console.log('\n⚠️  Timeout: El despliegue no se completó en 10 minutos');
  process.exit(1);
}, 10 * 60 * 1000);
