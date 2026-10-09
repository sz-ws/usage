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

  connect: {
    connectTitle: "Conectar Cloudflare",
    connectLead: "Son dos pasos. Cloudflare te pedirá que confirmes cada uno en su propia página.",
    reconnectTitle: "Volver a conectar Cloudflare",
    reconnectLead: "Los mismos dos pasos que la primera vez. Tu configuración y tu historial se conservan.",
    findTitle: "Encontrar tus cuentas",
    findText: "Cloudflare indica a esta página qué cuentas tienes y cómo se llaman. Ese acceso se descarta en cuanto llega la respuesta.",
    findAgain: "Elegir otras cuentas",
    grantTitle: "Permitir que esta página lea tu uso",
    grantText: "Esta página verá cuánto ha usado cada cuenta. No puede ver qué hay almacenado ni cambiar nada.",
    grantSame: "Elige las mismas cuentas en Cloudflare.",
    button: "Continuar con Cloudflare",
    signInLead: "Usa un inicio de sesión de Cloudflare con acceso a la cuenta de este Worker.",
    signInButton: "Iniciar sesión con Cloudflare",
    askedTitle: "Permisos que Cloudflare te pedirá",
    askedSettings: "Account Settings: Read, solo en el paso 1. Permite ver tus cuentas y sus miembros, y se descarta en cuanto se leen los nombres.",
    askedAnalytics: "Account Analytics: Read, en los dos pasos. Muestra cuánto ha usado cada producto. Solo se conserva el del paso 2.",
    problemTitle: "El inicio de sesión no se completó",
    tryAgain: "Intentar de nuevo",
    problems: {
      expired: "Ese inicio de sesión tardó más de diez minutos o se empezó en otro navegador.",
      declined: "No se concedió el acceso en la página de Cloudflare.",
      failed: "Cloudflare no respondió. Inténtalo de nuevo en un momento.",
      noAccounts: "No se eligió ninguna cuenta en la página de Cloudflare. Elige la cuenta donde está desplegado este Worker.",
      notFound: "Ninguna de las cuentas que elegiste tiene desplegado este Worker. Si lo desplegaste hace unos minutos, espera un minuto e inténtalo de nuevo.",
      notAllowed: "Ese inicio de sesión de Cloudflare no tiene acceso a la cuenta de este Worker. En la página de Cloudflare, elige la cuenta donde está desplegado este Worker.",
      otherAccount: "Esta página está conectada a una cuenta distinta de la que elegiste.",
      notKept: "Cloudflare no permitió que esta página siguiera conectada. Inténtalo de nuevo.",
      tooMany: "Demasiados intentos. Inténtalo de nuevo en un minuto.",
    },
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
