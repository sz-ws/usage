/*
 * Every sentence the relay shows. A language is one object in TEXT, under the
 * tag a browser asks for it by; pickLanguage reads the tags from there, so
 * adding a language is adding its object. test/relay.test.ts checks that each
 * one has the same strings as English.
 *
 * `approved` and `refused` are the two answers Cloudflare sends back, named as
 * decide.js names them.
 */

const en = {
  lang: "en",
  product: "Usage",

  home: {
    title: "Usage sign-in",
    body: "When you sign in to a usage page you host yourself, Cloudflare sends you here and you continue to your own page. Nothing is stored here.",
    link: "Usage on GitHub",
  },

  approved: {
    title: "Continue signing in",
    lead: "You are signing in to:",
    warning:
      "Continue only if this is the address of your own usage page. Whoever runs that address will be able to read your Cloudflare usage.",
    submit: "Continue",
    stop: "To stop, close this tab.",
  },

  refused: {
    title: "Sign-in did not finish",
    lead: "To try again, go back to:",
    warning: "Go back only if this is the address of your own usage page.",
    submit: "Go back",
    stop: "Or close this tab.",
  },

  problem: {
    title: "Sign-in did not finish",
    body: "This address only finishes a sign-in that a usage page started. To sign in, open your usage page and start there.",
  },
};

const zhTW = {
  lang: "zh-Hant",
  product: "Usage",

  home: {
    title: "Usage 登入",
    body: "登入你自架的用量頁面時，Cloudflare 會先把你送到這裡，你再從這裡回到自己的頁面。這裡不會儲存任何資料。",
    link: "Usage 的 GitHub 專案",
  },

  approved: {
    title: "繼續登入",
    lead: "你要登入的是：",
    warning: "確定這是你自己的用量頁面網址再繼續。管理這個網址的人會看得到你的 Cloudflare 用量。",
    submit: "繼續",
    stop: "不想繼續的話，關掉這個分頁就好。",
  },

  refused: {
    title: "登入沒有完成",
    lead: "要再試一次的話，回到：",
    warning: "確定這是你自己的用量頁面網址再回去。",
    submit: "回去",
    stop: "或直接關掉這個分頁。",
  },

  problem: {
    title: "登入沒有完成",
    body: "這個網址只能完成從用量頁面開始的登入。要登入的話，打開你的用量頁面，從那裡開始。",
  },
};

const zhCN = {
  lang: "zh-Hans",
  product: "Usage",

  home: {
    title: "Usage 登录",
    body: "登录你自己托管的用量页面时，Cloudflare 会把你送到这里，之后你继续前往自己的页面。这里不保存任何内容。",
    link: "GitHub 上的 Usage",
  },

  approved: {
    title: "继续登录",
    lead: "你正在登录到：",
    warning: "只有这是你自己用量页面的地址，才继续。管理这个地址的人能读到你的 Cloudflare 用量。",
    submit: "继续",
    stop: "要停止，请关闭此标签页。",
  },

  refused: {
    title: "登录没有完成",
    lead: "要再试一次，请返回到：",
    warning: "只有这是你自己用量页面的地址，才返回。",
    submit: "返回",
    stop: "或者关闭此标签页。",
  },

  problem: {
    title: "登录没有完成",
    body: "这个地址只用来完成用量页面发起的登录。要登录，请打开你的用量页面，从那里开始。",
  },
};

const ja = {
  lang: "ja",
  product: "Usage",

  home: {
    title: "Usage へのログイン",
    body: "ご自身で運用している使用量ページにログインすると、Cloudflare からここに案内され、そのあとご自身のページに進みます。ここには何も保存されません。",
    link: "GitHub 上の Usage",
  },

  approved: {
    title: "ログインを続ける",
    lead: "次のアドレスにログインしようとしています：",
    warning: "これがご自身の使用量ページのアドレスである場合にのみ続けてください。このアドレスを運用している人は、お使いの Cloudflare の使用量を読めるようになります。",
    submit: "続ける",
    stop: "続けない場合は、このタブを閉じてください。",
  },

  refused: {
    title: "ログインが完了しませんでした",
    lead: "もう一度試すには、次のアドレスに戻ってください：",
    warning: "これがご自身の使用量ページのアドレスである場合にのみ戻ってください。",
    submit: "戻る",
    stop: "または、このタブを閉じてください。",
  },

  problem: {
    title: "ログインが完了しませんでした",
    body: "このアドレスは、使用量ページが始めたログインを完了させるためだけのものです。ログインするには、ご自身の使用量ページを開いて、そこから始めてください。",
  },
};

const ko = {
  lang: "ko",
  product: "Usage",

  home: {
    title: "Usage 로그인",
    body: "직접 운영하는 사용량 페이지에 로그인하면 Cloudflare가 여러분을 이곳으로 보내고, 그다음 여러분의 페이지로 이어집니다. 이곳에는 아무것도 저장되지 않습니다.",
    link: "GitHub의 Usage",
  },

  approved: {
    title: "로그인 계속하기",
    lead: "다음 주소로 로그인하고 있습니다:",
    warning: "이 주소가 여러분 자신의 사용량 페이지 주소인 경우에만 계속하세요. 이 주소를 운영하는 사람은 여러분의 Cloudflare 사용량을 읽을 수 있게 됩니다.",
    submit: "계속하기",
    stop: "그만두려면 이 탭을 닫으세요.",
  },

  refused: {
    title: "로그인이 끝나지 않았습니다",
    lead: "다시 시도하려면 다음 주소로 돌아가세요:",
    warning: "이 주소가 여러분 자신의 사용량 페이지 주소인 경우에만 돌아가세요.",
    submit: "돌아가기",
    stop: "또는 이 탭을 닫으세요.",
  },

  problem: {
    title: "로그인이 끝나지 않았습니다",
    body: "이 주소는 사용량 페이지가 시작한 로그인을 마무리할 때만 쓰입니다. 로그인하려면 여러분의 사용량 페이지를 열어 거기서 시작하세요.",
  },
};

const es = {
  lang: "es",
  product: "Usage",

  home: {
    title: "Inicio de sesión en Usage",
    body:
      "Cuando inicias sesión en una página de uso que alojas tú mismo, Cloudflare te envía aquí y continúas en tu propia página. Aquí no se guarda nada.",
    link: "Usage en GitHub",
  },

  approved: {
    title: "Continuar el inicio de sesión",
    lead: "Estás iniciando sesión en:",
    warning:
      "Continúa solo si esta es la dirección de tu propia página de uso. Quien esté detrás de esa dirección podrá leer el uso de tu cuenta de Cloudflare.",
    submit: "Continuar",
    stop: "Para cancelar, cierra esta pestaña.",
  },

  refused: {
    title: "El inicio de sesión no se completó",
    lead: "Para intentarlo de nuevo, vuelve a:",
    warning: "Vuelve solo si esta es la dirección de tu propia página de uso.",
    submit: "Volver",
    stop: "O cierra esta pestaña.",
  },

  problem: {
    title: "El inicio de sesión no se completó",
    body:
      "Esta dirección solo termina un inicio de sesión que empezó una página de uso. Para iniciar sesión, abre tu página de uso y empieza desde allí.",
  },
};

const fr = {
  lang: "fr",
  product: "Usage",

  home: {
    title: "Connexion à Usage",
    body:
      "Quand vous vous connectez à une page de consommation que vous hébergez vous-même, Cloudflare vous envoie ici, puis vous continuez sur votre propre page. Rien n'est stocké ici.",
    link: "Usage sur GitHub",
  },

  approved: {
    title: "Continuer la connexion",
    lead: "Vous vous connectez à :",
    warning:
      "Continuez seulement si c'est l'adresse de votre propre page de consommation. Quiconque gère cette adresse pourra lire votre consommation Cloudflare.",
    submit: "Continuer",
    stop: "Pour arrêter, fermez cet onglet.",
  },

  refused: {
    title: "La connexion n'a pas abouti",
    lead: "Pour réessayer, revenez à :",
    warning: "Revenez seulement si c'est l'adresse de votre propre page de consommation.",
    submit: "Revenir",
    stop: "Ou fermez cet onglet.",
  },

  problem: {
    title: "La connexion n'a pas abouti",
    body:
      "Cette adresse ne termine qu'une connexion lancée par une page de consommation. Pour vous connecter, ouvrez votre page de consommation et commencez-y.",
  },
};

const de = {
  lang: "de",
  product: "Usage",

  home: {
    title: "Anmeldung bei Usage",
    body:
      "Wenn du dich bei einer Nutzungsseite anmeldest, die du selbst betreibst, schickt Cloudflare dich hierher. Von hier geht es weiter zu deiner eigenen Nutzungsseite. Hier wird nichts gespeichert.",
    link: "Usage auf GitHub",
  },

  approved: {
    title: "Anmeldung fortsetzen",
    lead: "Du meldest dich bei dieser Adresse an:",
    warning:
      "Mach nur weiter, wenn dies die Adresse deiner eigenen Nutzungsseite ist. Wer diese Adresse betreibt, kann deine Cloudflare-Nutzung lesen.",
    submit: "Fortfahren",
    stop: "Zum Abbrechen schließe diesen Tab.",
  },

  refused: {
    title: "Anmeldung nicht abgeschlossen",
    lead: "Um es erneut zu versuchen, geh zurück zu:",
    warning: "Geh nur zurück, wenn dies die Adresse deiner eigenen Nutzungsseite ist.",
    submit: "Zurück",
    stop: "Oder schließe diesen Tab.",
  },

  problem: {
    title: "Anmeldung nicht abgeschlossen",
    body:
      "Diese Adresse schließt nur eine Anmeldung ab, die eine Nutzungsseite gestartet hat. Um dich anzumelden, öffne deine Nutzungsseite und fang dort an.",
  },
};

const ptBR = {
  lang: "pt-BR",
  product: "Usage",

  home: {
    title: "Entrar no Usage",
    body:
      "Quando você entra em uma página de uso que você mesmo hospeda, a Cloudflare envia você para cá, e daí você continua na sua própria página. Nada fica guardado aqui.",
    link: "Usage no GitHub",
  },

  approved: {
    title: "Continuar o login",
    lead: "Você está entrando em:",
    warning:
      "Continue só se este for o endereço da sua própria página de uso. Quem mantém esse endereço vai conseguir ler o seu uso da Cloudflare.",
    submit: "Continuar",
    stop: "Para parar, feche esta aba.",
  },

  refused: {
    title: "O login não foi concluído",
    lead: "Para tentar novamente, volte para:",
    warning: "Volte só se este for o endereço da sua própria página de uso.",
    submit: "Voltar",
    stop: "Ou feche esta aba.",
  },

  problem: {
    title: "O login não foi concluído",
    body:
      "Este endereço só conclui um login que uma página de uso começou. Para entrar, abra a sua página de uso e comece por lá.",
  },
};

export const TEXT = { en, "zh-TW": zhTW, "zh-CN": zhCN, ja, ko, es, fr, de, "pt-BR": ptBR };

export const DEFAULT_LANGUAGE = "en";

/** Where Chinese is written in Traditional characters, by region or by the script a tag names. */
const TRADITIONAL = new Set(["tw", "hk", "mo", "hant"]);

/** The language in TEXT that serves one tag ("en-GB", "zh-Hant-HK"). Null when none does. */
function languageFor(tag) {
  const lower = String(tag).trim().toLowerCase();
  if (lower === "") return null;

  const tags = Object.keys(TEXT);
  const exact = tags.find((known) => known.toLowerCase() === lower);
  if (exact) return exact;

  const [language, ...rest] = lower.split("-");
  if (language === "zh") {
    const written = rest.some((part) => TRADITIONAL.has(part)) ? "zh-TW" : "zh-CN";
    return Object.hasOwn(TEXT, written) ? written : null;
  }
  return tags.find((known) => known.toLowerCase().split("-")[0] === language) ?? null;
}

/**
 * The language for `navigator.languages`: the first one listed that there is
 * text for, or English. The same rule the usage page follows.
 */
export function pickLanguage(languages) {
  for (const tag of languages ?? []) {
    const found = languageFor(tag);
    if (found) return found;
  }
  return DEFAULT_LANGUAGE;
}
