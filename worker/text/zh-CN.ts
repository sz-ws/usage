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
