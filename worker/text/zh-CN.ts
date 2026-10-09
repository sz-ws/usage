import type { PageText } from "./types";

export const zhCN: PageText = {
  lang: "zh-Hans",
  product: "Cloudflare 用量",

  signIn: {
    title: "登录",
    keyLabel: "访问密钥",
    keyHint: "部署时设置的 ACCESS_KEY。",
    submit: "登录",
    wrongKey: "访问密钥不对。",
    tooMany: "尝试次数太多，请一分钟后再试。",
  },

  connect: {
    connectTitle: "连接 Cloudflare",
    connectLead: "分两步完成，每一步都需要你在 Cloudflare 的页面上确认。",
    reconnectTitle: "重新连接 Cloudflare",
    reconnectLead: "和第一次一样，分两步完成。你的设置和历史记录都会保留。",
    findTitle: "找出你的账户",
    findText: "Cloudflare 会告诉这个页面你有哪些账户，以及它们叫什么名字。拿到结果后，这项权限会马上交还。",
    findAgain: "重新选择",
    grantTitle: "允许这个页面读取用量",
    grantText: "这个页面能看到每个账户用了多少，看不到存储的数据，也不能更改任何东西。",
    grantSame: "在 Cloudflare 选同样的账户。",
    button: "前往 Cloudflare 继续",
    signInLead: "请用能访问这个 Worker 所在账户的 Cloudflare 账号登录。",
    signInButton: "用 Cloudflare 登录",
    askedTitle: "Cloudflare 会要求的权限",
    askedSettings: "Account Settings: Read，只在第一步使用。它会列出你的账户和成员，读到名称后就会交还。",
    askedAnalytics: "Account Analytics: Read，两步都会用到。它显示每个产品用了多少。只有第二步得到的那一份会保留下来。",
    problemTitle: "登录没有完成",
    tryAgain: "再试一次",
    problems: {
      expired: "这次登录超过了十分钟，或者是在另一个浏览器里开始的。",
      declined: "你没有在 Cloudflare 的页面上允许访问。",
      failed: "Cloudflare 没有响应，请稍后再试。",
      noAccounts: "没有在 Cloudflare 的页面上选择账户。请选择这个 Worker 所在的账户。",
      notFound: "你选的账户里都没有运行这个 Worker。如果是刚刚部署的，请等一分钟后再试。",
      notAllowed: "这个 Cloudflare 账号无法读取这个 Worker 所在的账户。请在 Cloudflare 的页面上选择这个 Worker 所在的账户。",
      otherAccount: "这个页面已连接到另一个账户，和你刚选的不一样。",
      notKept: "Cloudflare 没有让这个页面保持连接，请再试一次。",
      tooMany: "尝试次数太多，请一分钟后再试。",
    },
  },

  consent: {
    title: (client) => `让 ${client} 读取你的 Cloudflare 用量？`,
    scope: "它可以读取你的用量数据和预估，但不能更改任何东西。",
    publishedBy: (domain) => `由 ${domain} 发布。`,
    selfNamed: "这个名称由 app 自己填写，没有经过验证。",
    sentTo: (host) => `访问权限会交给 ${host}。`,
    sentToApp: (scheme) => `访问权限会交给这台电脑上负责打开 ${scheme} 链接的 app。`,
    loopback: "只有你刚刚才从这台电脑上的 app 发起连接时，才继续。",
    allow: "允许",
    deny: "拒绝",
  },

  setup: {
    title: "还需完成设置",
    lead: "在 Worker 上设置好以下内容即可继续：",
    missing: {
      ANALYTICS_TOKEN: "ANALYTICS_TOKEN：有 Account Analytics: Read 权限的 Cloudflare API token。",
      ACCESS_KEY: "ACCESS_KEY：登录时使用的密码。",
    },
    shortKey: (minimum) => `ACCESS_KEY：至少需要 ${minimum} 个字符。`,
    where: "在 Cloudflare 控制台：这个 Worker → Settings → Variables and Secrets。",
  },

  problem: {
    title: "连接失败",
    invalid: "这个请求无效。",
    expired: "这个请求已过期，或者已经用过。",
    unverified: "无法验证要求连接的 app。",
    startAgain: "请回到那个 app 重新连接。",
  },
};
