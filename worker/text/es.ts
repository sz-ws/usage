import type { PageText } from "./types";

export const es: PageText = {
  lang: "es",
  product: "Uso de Cloudflare",

  signIn: {
    title: "Iniciar sesión",
    keyLabel: "Clave de acceso",
    keyHint: "El ACCESS_KEY que definiste al desplegar.",
    submit: "Iniciar sesión",
    wrongKey: "Esa no es la clave de acceso.",
    tooMany: "Demasiados intentos. Inténtalo de nuevo en un minuto.",
  },

  consent: {
    title: (client) => `¿Permitir que ${client} lea tu uso de Cloudflare?`,
    scope: "Podrá leer tus cifras de uso y tus previsiones. No puede cambiar nada.",
    publishedBy: (domain) => `Publicado por ${domain}.`,
    selfNamed: "El nombre lo indica la propia app y no está verificado.",
    sentTo: (host) => `Tu acceso se enviará a ${host}.`,
    sentToApp: (scheme) => `Tu acceso se enviará a la app de este equipo que abre enlaces ${scheme}.`,
    loopback: "Continúa solo si acabas de iniciar la conexión desde una app de este equipo.",
    allow: "Permitir",
    deny: "Rechazar",
  },

  setup: {
    title: "Termina la configuración",
    lead: "Define estos valores en el Worker para continuar:",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN: un token de API de Cloudflare con el permiso Account Analytics: Read.",
      ACCESS_KEY: "ACCESS_KEY: la contraseña con la que vas a iniciar sesión.",
    },
    shortKey: (minimum) => `ACCESS_KEY: al menos ${minimum} caracteres.`,
    where: "En el dashboard de Cloudflare: este Worker → Settings → Variables and Secrets.",
  },

  problem: {
    title: "Error de conexión",
    invalid: "La solicitud no es válida.",
    expired: "La solicitud caducó o ya se usó.",
    unverified: "No se pudo verificar la app que pide conectarse.",
    startAgain: "Vuelve a intentar la conexión desde la app.",
  },
};
