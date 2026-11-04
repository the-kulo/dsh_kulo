/** WeCom (企业微信) callback event values projected after decryption. */

// ---- Inbound message types (after XML → JSON normalization) ----

/** Shared fields present on every WeCom callback message. */
export interface WecomBaseMessage {
  /** Enterprise WeChat CorpId. */
  readonly ToUserName: string
  /** Sender's UserId or bot callback token. */
  readonly FromUserName: string
  /** Unix epoch seconds. */
  readonly CreateTime: number
  /** Message type discriminator. */
  readonly MsgType: string
  /** Unique message id from WeCom server. */
  readonly MsgId: string
  /** WeCom application agent id. */
  readonly AgentID?: number | undefined
}

/** Text message from a user. */
export interface WecomTextMessage extends WecomBaseMessage {
  readonly MsgType: 'text'
  readonly Content: string
}

/** Image message from a user. */
export interface WecomImageMessage extends WecomBaseMessage {
  readonly MsgType: 'image'
  readonly PicUrl: string
  readonly MediaId: string
}

/** Voice message from a user. */
export interface WecomVoiceMessage extends WecomBaseMessage {
  readonly MsgType: 'voice'
  readonly MediaId: string
  readonly Format: string
}

/** Event notification (e.g. click menu, enter app, location). */
export interface WecomEventMessage {
  readonly ToUserName: string
  readonly FromUserName: string
  readonly CreateTime: number
  readonly MsgType: 'event'
  readonly Event: string
  readonly EventKey?: string | undefined
  readonly AgentID?: number | undefined
}

/** Union of all normalized WeCom callback messages. */
export type WecomMessage =
  | WecomTextMessage
  | WecomImageMessage
  | WecomVoiceMessage
  | WecomEventMessage

/** Provider event supplied to `WebhookRule<'wecom'>`. */
export interface WecomWebhookEvent {
  /** Normalized message after XML parsing and decryption. */
  readonly message: WecomMessage
  /** Raw XML body before normalization, for adapter-specific processing. */
  readonly rawXml: string
}

declare module '@deepseek-ai/dsh-webhook' {
  interface WebhookEventMap {
    wecom: WecomWebhookEvent
  }
}

// ---- Outbound message types (for agent → WeCom replies) ----

/** Text reply sent back through the WeCom webhook URL. */
export interface WecomTextReply {
  readonly msgtype: 'text'
  readonly text: {
    readonly content: string
    /** Mentioned userid list; `@all` for everyone. */
    readonly mentioned_list?: readonly string[]
    readonly mentioned_mobile_list?: readonly string[]
  }
}

/** Markdown reply sent back through the WeCom webhook URL. */
export interface WecomMarkdownReply {
  readonly msgtype: 'markdown'
  readonly markdown: {
    readonly content: string
  }
}

/** Outbound reply shape. */
export type WecomReply = WecomTextReply | WecomMarkdownReply