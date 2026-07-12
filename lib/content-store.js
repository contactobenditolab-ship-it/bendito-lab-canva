// lib/content-store.js — Mapa slot de imagen -> URL pública en Vercel Blob,
// persistido como un único JSON en el propio Blob store.
const { put, list } = require('@vercel/blob');

const CONTENT_PATH = 'content/site-content.json';

async function findContentBlob() {
  const { blobs } = await list({ prefix: CONTENT_PATH, limit: 1 });
  return blobs && blobs[0] ? blobs[0] : null;
}

async function readContent() {
  const blob = await findContentBlob();
  if (!blob) return { images: {}, updatedAt: null };
  try {
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return { images: {}, updatedAt: null };
    const data = await res.json();
    if (!data || typeof data !== 'object') return { images: {}, updatedAt: null };
    data.images = data.images || {};
    return data;
  } catch {
    return { images: {}, updatedAt: null };
  }
}

async function writeContent(data) {
  const body = JSON.stringify(data, null, 2);
  return put(CONTENT_PATH, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

module.exports = { readContent, writeContent, CONTENT_PATH };
