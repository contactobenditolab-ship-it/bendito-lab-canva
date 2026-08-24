/**
 * Google Analytics 4 Setup Script
 * Añade el tag de GA4 y configura eventos de conversión
 * 
 * INSTRUCCIONES:
 * 1. Reemplaza 'G-XXXXXXXXXX' con tu ID de medición GA4
 * 2. Copia este código al <head> de tu HTML, después de <meta charset>
 * 3. O importa como módulo en tu framework
 */

// Configuración
const GA4_ID = "G-XXXXXXXXXX"; // Reemplazar con tu ID real

/**
 * Inicializar GA4
 */
function initGA4() {
  if (!GA4_ID || GA4_ID === "G-XXXXXXXXXX") {
    console.warn("[GA4] ID no configurado. Reemplaza G-XXXXXXXXXX en ga4.js");
    return;
  }

  // Script de GA4 (async)
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  // Inicializar gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", GA4_ID, {
    // Configuración
    cookie_flags: "SameSite=None;Secure",
    anonymize_ip: true, // GDPR
    allow_google_signals: false, // GDPR
    allow_ad_personalization_signals: false, // GDPR
  });

  window.gtag = gtag;
}

/**
 * Registrar evento de conversión
 * Ejemplos:
 *   trackConversion('cotizacion_generada', { cantidad: 5, valor_estimado: 250 })
 *   trackConversion('contacto_enviado', { tema: 'B2B' })
 */
function trackConversion(eventName, eventData = {}) {
  if (!window.gtag) {
    console.warn("[GA4] gtag no inicializado");
    return;
  }

  window.gtag("event", eventName, {
    timestamp: new Date().toISOString(),
    ...eventData,
  });
}

/**
 * Registrar evento de página vista personalizado
 */
function trackPageView(pageName, pageType = "page") {
  if (!window.gtag) return;
  window.gtag("event", "page_view", {
    page_title: pageName,
    page_path: window.location.pathname,
    page_type: pageType,
  });
}

/**
 * Eventos predefinidos para Bendito Lab
 */
const EVENTS = {
  // Catálogo
  PRODUCT_VIEW: "product_view",
  ADD_TO_CART: "add_to_cart",
  REMOVE_FROM_CART: "remove_from_cart",

  // Conversiones principales
  COTIZACION_GENERADA: "cotizacion_generada",
  COTIZACION_DESCARGADA: "cotizacion_descargada",
  CONTACTO_ENVIADO: "contacto_enviado",
  COLABORADOR_SOLICITUD: "colaborador_solicitud",

  // Dilo Bonito
  EVENTO_CONSULTA: "evento_consulta",
  EVENTO_RESERVA: "evento_reserva",

  // Engagement
  CATALOGO_FILTRO: "catalogo_filtro",
  BUSQUEDA: "busqueda",
  VIDEO_INICIO: "video_inicio",
  LLAMADA_CLICK: "llamada_click",
};

/**
 * Helpers de seguimiento para eventos específicos
 */
const tracking = {
  // Catálogo
  verProducto: (productoId, nombre, precio) => {
    trackConversion(EVENTS.PRODUCT_VIEW, {
      product_id: productoId,
      product_name: nombre,
      value: precio,
      currency: "EUR",
    });
  },

  // Cotización
  cotizacionGenerada: (cantidadArticulos, valorEstimado) => {
    trackConversion(EVENTS.COTIZACION_GENERADA, {
      cantidad_articulos: cantidadArticulos,
      valor_estimado: valorEstimado,
      currency: "EUR",
    });
  },

  cotizacionDescargada: (cotizacionId) => {
    trackConversion(EVENTS.COTIZACION_DESCARGADA, {
      cotizacion_id: cotizacionId,
    });
  },

  // Contacto
  contactoEnviado: (tema, asunto) => {
    trackConversion(EVENTS.CONTACTO_ENVIADO, {
      tema,
      asunto,
    });
  },

  // Colaborador
  colaboradorSolicitud: (tipo) => {
    trackConversion(EVENTS.COLABORADOR_SOLICITUD, {
      tipo, // "distribuidor", "personalizador", etc
    });
  },

  // Dilo Bonito
  eventoConsulta: (tipoEvento, numeroPersonas) => {
    trackConversion(EVENTS.EVENTO_CONSULTA, {
      tipo_evento: tipoEvento,
      numero_personas: numeroPersonas,
    });
  },

  eventoReserva: (tipoEvento, numeroDias, precioEstimado) => {
    trackConversion(EVENTS.EVENTO_RESERVA, {
      tipo_evento: tipoEvento,
      numero_dias: numeroDias,
      precio_estimado: precioEstimado,
      currency: "EUR",
    });
  },

  // Engagement
  catalogoFiltro: (filtro, valor) => {
    trackConversion(EVENTS.CATALOGO_FILTRO, {
      filtro,
      valor,
    });
  },

  busqueda: (termino, resultados) => {
    trackConversion(EVENTS.BUSQUEDA, {
      termino,
      numero_resultados: resultados,
    });
  },
};

// Exportar para uso en módulos
if (typeof module !== "undefined" && module.exports) {
  module.exports = { initGA4, trackConversion, trackPageView, EVENTS, tracking };
}

// Auto-inicializar si es inline
if (document.currentScript) {
  initGA4();
}
