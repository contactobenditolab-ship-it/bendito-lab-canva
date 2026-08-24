#!/usr/bin/env node

/**
 * Analyze bundle sizes in bendito-lab-canva
 * Identifica archivos grandes y oportunidades de optimización
 */

const fs = require("fs");
const path = require("path");

const JS_DIR = path.join(__dirname, "../js");

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

function classifyPriority(name, size) {
  // En bytes
  const KB = 1024;
  const SIZE_MB = size / (KB * KB);

  if (name.includes("admin") && SIZE_MB > 1) return "critical";
  if (name.includes("catalogo-comun") && SIZE_MB > 0.8) return "high";
  if (name.includes("bl-images") && SIZE_MB > 0.8) return "high";
  if (SIZE_MB > 0.5) return "medium";
  if (SIZE_MB > 0.3) return "low";
  return "low";
}

function analyze() {
  console.log("\n📊 BUNDLE SIZE ANALYSIS — bendito-lab-canva\n");

  if (!fs.existsSync(JS_DIR)) {
    console.log("❌ js/ directory not found");
    return;
  }

  const files = fs
    .readdirSync(JS_DIR)
    .filter((f) => f.endsWith(".js"))
    .map((name) => ({
      name,
      size: getFileSize(path.join(JS_DIR, name)),
    }))
    .map((f) => ({
      ...f,
      sizeKb: f.size / 1024,
      priority: classifyPriority(f.name, f.size),
    }))
    .sort((a, b) => b.size - a.size);

  // Mostrar tabla
  console.log("File                                 Size      Priority");
  console.log("-".repeat(70));

  files.forEach((f) => {
    const icon =
      f.priority === "critical"
        ? "🔴"
        : f.priority === "high"
          ? "🟠"
          : f.priority === "medium"
            ? "🟡"
            : "🟢";
    console.log(
      `${icon} ${f.name.padEnd(35)} ${(f.sizeKb.toFixed(1) + "KB").padEnd(10)} ${f.priority}`
    );
  });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMb = totalSize / (1024 * 1024);

  console.log("-".repeat(70));
  console.log(`Total: ${totalSizeMb.toFixed(2)}MB\n`);

  // Recomendaciones
  const criticalFiles = files.filter((f) => f.priority === "critical");
  if (criticalFiles.length > 0) {
    console.log("⚠️  OPTIMIZATION OPPORTUNITIES:\n");

    if (files.some((f) => f.name.includes("admin") && f.sizeKb > 1000)) {
      console.log("  • admin-1.js es muy grande (>1MB)");
      console.log("    → Considerar code splitting por secciones (catalogo, presupuestos, etc)");
      console.log("    → Usar lazy loading para componentes de administración\n");
    }

    if (files.some((f) => f.name.includes("catalogo-comun") && f.sizeKb > 800)) {
      console.log("  • catalogo-comun.js es grande (>800KB)");
      console.log("    → Extraer lógica de filtrado a módulo separado");
      console.log("    → Usar dynamic imports para calculadora y busca-texto\n");
    }

    if (files.some((f) => f.name.includes("bl-images") && f.sizeKb > 800)) {
      console.log("  • bl-images.js es grande (>800KB)");
      console.log("    → Considerar WebP format + lazy loading de imágenes");
      console.log("    → Usar Intersection Observer para galerías\n");
    }
  }

  console.log("📈 Next steps:");
  console.log("  1. Run webpack/esbuild analyzer if available");
  console.log("  2. Identify unused dependencies with npm audit");
  console.log("  3. Test Core Web Vitals (LCP, FID, CLS)\n");
}

analyze();
