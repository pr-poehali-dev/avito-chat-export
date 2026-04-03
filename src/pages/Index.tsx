import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

const AVITO_AUTH_URL = "https://functions.poehali.dev/9f643d6b-b87f-4d31-9588-03067993ba01";
const AVITO_CHATS_URL = "https://functions.poehali.dev/b11d7cfc-045e-47b0-b0cd-89dec73bde14";
const AVITO_MESSAGES_URL = "https://functions.poehali.dev/c3bc0f84-fbae-48a0-bcc6-5e791b369ea6";

interface AuthStatus {
  connected: boolean;
  token_preview?: string;
  expires_at?: string;
  expires_in_minutes?: number;
  updated_at?: string;
  message?: string;
  user_id?: number;
}

interface AvitoChat {
  id: string;
  user_id: number;
  author_name: string;
  author_id: number;
  item_title: string;
  item_id?: number;
  item_url?: string;
  last_message_text: string;
  last_message_time: string | null;
  unread_count: number;
  is_new: boolean;
}

interface AvitoMessage {
  id: string;
  from: "me" | "them";
  text: string;
  time: string | null;
  time_display: string;
  type: string;
}

type Tab = "chats" | "stats" | "sync" | "settings";
type FilterStatus = "all" | "new" | "read";

const SYNC_LOGS = [
  { id: 1, time: "только что", event: "Синхронизация чатов", status: "ok", count: 0 },
];

function formatTime(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays} дн.`;
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function avatarLetter(name: string): string {
  return (name || "?")[0].toUpperCase();
}

export default function Index() {
  const [tab, setTab] = useState<Tab>("chats");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const [chats, setChats] = useState<AvitoChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<AvitoMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [userId, setUserId] = useState("");
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch(AVITO_AUTH_URL);
      const data = await res.json();
      setAuthStatus(data);
    } catch {
      setAuthStatus(null);
    }
  }, []);

  const fetchChats = useCallback(async () => {
    setChatsLoading(true);
    setChatsError("");
    try {
      const res = await fetch(AVITO_CHATS_URL);
      const data = await res.json();
      if (!res.ok || data.error) {
        setChatsError(data.error || "Ошибка загрузки чатов");
        setChats([]);
      } else {
        setChats(data.chats || []);
        if (data.chats?.length > 0 && !selectedChatId) {
          setSelectedChatId(data.chats[0].id);
        }
      }
    } catch {
      setChatsError("Не удалось загрузить чаты");
    } finally {
      setChatsLoading(false);
    }
  }, [selectedChatId]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`${AVITO_MESSAGES_URL}?chat_id=${chatId}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "chats") fetchChats();
  }, [tab]);

  useEffect(() => {
    if (tab === "settings") fetchAuthStatus();
  }, [tab, fetchAuthStatus]);

  useEffect(() => {
    if (selectedChatId) fetchMessages(selectedChatId);
  }, [selectedChatId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !userId.trim()) {
      setAuthError("Введите Client ID, Client Secret и User ID");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await fetch(AVITO_AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          user_id: parseInt(userId.trim(), 10) || userId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthSuccess(`Подключено! Токен действует ${data.expires_in_minutes} минут`);
        setClientId("");
        setClientSecret("");
        setUserId("");
        await fetchAuthStatus();
      } else {
        setAuthError(data.error || "Ошибка подключения");
      }
    } catch {
      setAuthError("Сервер недоступен, попробуйте позже");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId || sendingMessage) return;
    const text = newMessage.trim();
    setNewMessage("");
    setSendingMessage(true);

    const optimistic: AvitoMessage = {
      id: `opt-${Date.now()}`,
      from: "me",
      text,
      time: new Date().toISOString(),
      time_display: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      type: "text",
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(AVITO_MESSAGES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: selectedChatId, message: text }),
      });
      if (res.ok) {
        setTimeout(() => fetchMessages(selectedChatId), 1000);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredChats = chats.filter((c) => {
    const matchStatus =
      filter === "all" ||
      (filter === "new" && c.is_new) ||
      (filter === "read" && !c.is_new);
    const matchSearch =
      search === "" ||
      c.author_name.toLowerCase().includes(search.toLowerCase()) ||
      c.item_title.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message_text.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const activeChat = chats.find((c) => c.id === selectedChatId);

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageSquare", label: "Чаты" },
    { id: "stats", icon: "BarChart3", label: "Статистика" },
    { id: "sync", icon: "RefreshCw", label: "История" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  const STATUS_LABELS: Record<FilterStatus, string> = {
    all: "Все",
    new: "Непрочитанные",
    read: "Прочитанные",
  };

  const totalUnread = chats.reduce((a, c) => a + c.unread_count, 0);

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      {/* Sidebar nav */}
      <nav className="w-16 flex flex-col items-center py-6 gap-1 border-r border-border bg-card shrink-0">
        <div className="mb-6">
          <div className="w-9 h-9 rounded-xl bg-foreground flex items-center justify-center">
            <span className="text-background text-xs font-bold">A</span>
          </div>
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative ${
              tab === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title={item.label}
          >
            <Icon name={item.icon} fallback="Circle" size={18} />
            {item.id === "chats" && totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Chats tab */}
      {tab === "chats" && (
        <>
          {/* Chat list */}
          <div className="w-80 flex flex-col border-r border-border bg-card shrink-0">
            <div className="px-4 pt-5 pb-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-base font-semibold text-foreground">Переписки</h1>
                <div className="flex items-center gap-2">
                  {totalUnread > 0 && (
                    <span className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                      {totalUnread} новых
                    </span>
                  )}
                  <button
                    onClick={fetchChats}
                    disabled={chatsLoading}
                    className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                    title="Обновить"
                  >
                    <Icon name="RefreshCw" size={13} className={chatsLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              <div className="relative mb-3">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по чатам..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm bg-secondary border-0 focus-visible:ring-1"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {(["all", "new", "read"] as FilterStatus[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-150 ${
                      filter === f
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {STATUS_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
              {chatsLoading ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <Icon name="Loader" size={24} className="mb-2 animate-spin opacity-40" />
                  Загружаю чаты...
                </div>
              ) : chatsError ? (
                <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
                  <Icon name="WifiOff" size={28} className="mb-2 text-muted-foreground opacity-30" />
                  <p className="text-xs text-muted-foreground mb-3">{chatsError}</p>
                  {chatsError.includes("Подключите") && (
                    <button
                      onClick={() => setTab("settings")}
                      className="text-xs text-foreground underline"
                    >
                      Перейти в Настройки
                    </button>
                  )}
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <Icon name="Inbox" size={28} className="mb-2 opacity-30" />
                  {chats.length === 0 ? "Чатов не найдено" : "Ничего не найдено"}
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`w-full text-left px-4 py-3 chat-item-hover border-b border-border/50 last:border-0 ${
                      selectedChatId === chat.id ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                        chat.is_new ? "bg-orange-100 text-orange-700" : "bg-foreground/10 text-foreground"
                      }`}>
                        {avatarLetter(chat.author_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">{chat.author_name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatTime(chat.last_message_time)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-1">{chat.item_title}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate flex-1">{chat.last_message_text}</span>
                          {chat.unread_count > 0 && (
                            <span className="ml-2 min-w-4 h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center shrink-0">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat window */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeChat ? (
              <>
                <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-semibold">
                      {avatarLetter(activeChat.author_name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{activeChat.author_name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {activeChat.item_url ? (
                          <a
                            href={activeChat.item_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground transition-colors underline"
                          >
                            {activeChat.item_title}
                          </a>
                        ) : (
                          <span>{activeChat.item_title}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeChat.is_new && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700">
                        Непрочитано
                      </span>
                    )}
                    <button
                      onClick={() => selectedChatId && fetchMessages(selectedChatId)}
                      className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors"
                      title="Обновить"
                    >
                      <Icon name="RefreshCw" size={14} className={messagesLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-4">
                  {messagesLoading ? (
                    <div className="flex justify-center pt-10">
                      <Icon name="Loader" size={24} className="animate-spin text-muted-foreground opacity-40" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                      <Icon name="MessageCircle" size={28} className="mb-2 opacity-20" />
                      Сообщений пока нет
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"} animate-fade-in`}>
                        <div
                          className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            msg.from === "me"
                              ? "bg-foreground text-background rounded-br-sm"
                              : "bg-card border border-border text-foreground rounded-bl-sm"
                          }`}
                        >
                          {msg.text || <span className="opacity-40 italic">Медиафайл</span>}
                          <div className={`text-[10px] mt-1 ${msg.from === "me" ? "text-background/50" : "text-muted-foreground"}`}>
                            {msg.time_display || formatTime(msg.time)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-6 py-4 border-t border-border bg-card shrink-0">
                  <div className="flex gap-2 items-end">
                    <Input
                      placeholder="Написать сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 bg-secondary border-0 focus-visible:ring-1 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    />
                    <button
                      disabled={sendingMessage || !newMessage.trim()}
                      className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity shrink-0 disabled:opacity-30"
                      onClick={handleSendMessage}
                    >
                      <Icon name={sendingMessage ? "Loader" : "Send"} size={15} className={sendingMessage ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Icon name="MessageSquare" size={48} className="mb-3 opacity-20" />
                <p className="text-sm">Выберите чат</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8 animate-fade-in">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold text-foreground mb-1">Статистика</h2>
            <p className="text-sm text-muted-foreground mb-8">Аналитика по чатам</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { label: "Всего чатов", value: String(chats.length), icon: "MessageSquare", sub: "загружено из Avito" },
                { label: "Непрочитанных", value: String(totalUnread), icon: "Bell", sub: "требуют ответа" },
                { label: "Прочитанных", value: String(chats.filter((c) => !c.is_new).length), icon: "CheckCircle", sub: "обработано" },
                { label: "Объявлений", value: String(new Set(chats.map((c) => c.item_id)).size), icon: "Tag", sub: "уникальных" },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 stat-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                      <Icon name={s.icon} fallback="Circle" size={16} className="text-foreground" />
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-foreground mb-1">{s.value}</div>
                  <div className="text-sm font-medium text-foreground mb-1">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>

            {chats.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-5">Активные чаты</h3>
                <div className="space-y-3">
                  {chats.slice(0, 8).map((chat) => (
                    <div key={chat.id} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        chat.is_new ? "bg-orange-100 text-orange-700" : "bg-secondary text-foreground"
                      }`}>
                        {avatarLetter(chat.author_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground truncate">{chat.author_name}</span>
                          <span className="text-xs text-muted-foreground ml-2 truncate max-w-32">{chat.item_title}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${chat.is_new ? "bg-orange-400" : "bg-foreground/40"}`}
                            style={{ width: chat.is_new ? "100%" : "30%" }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatTime(chat.last_message_time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chats.length === 0 && !chatsLoading && (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <Icon name="BarChart3" size={32} className="mx-auto mb-3 opacity-20 text-foreground" />
                <p className="text-sm text-muted-foreground">Нет данных. Сначала подключите Avito в Настройках.</p>
                <button onClick={() => setTab("settings")} className="mt-3 text-sm text-foreground underline">
                  Перейти в Настройки
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync tab */}
      {tab === "sync" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8 animate-fade-in">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-foreground">История синхронизации</h2>
              <button
                onClick={fetchChats}
                disabled={chatsLoading}
                className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary hover:bg-border px-3 py-1.5 rounded-lg transition-colors"
              >
                <Icon name="RefreshCw" size={13} className={chatsLoading ? "animate-spin" : ""} />
                Синхронизировать
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-8">
              Чатов загружено: {chats.length}
            </p>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {SYNC_LOGS.map((log, i) => (
                <div
                  key={log.id}
                  className={`flex items-center gap-4 px-5 py-4 ${i < SYNC_LOGS.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50">
                    <Icon name="CheckCircle" size={15} className="text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{log.event}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{chats.length} чатов</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{log.time}</div>
                </div>
              ))}
              {chatsError && (
                <div className="flex items-center gap-4 px-5 py-4 border-t border-border">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                    <Icon name="XCircle" size={15} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground">Ошибка синхронизации</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{chatsError}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8 animate-fade-in">
          <div className="max-w-xl mx-auto">
            <h2 className="text-xl font-semibold text-foreground mb-1">Настройки</h2>
            <p className="text-sm text-muted-foreground mb-8">Управление аккаунтом и подключением</p>

            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Подключение к Avito API</h3>
                  {authStatus && (
                    <span className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                      authStatus.connected
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${authStatus.connected ? "bg-emerald-500" : "bg-orange-400"}`} />
                      {authStatus.connected ? "Подключено" : "Не подключено"}
                    </span>
                  )}
                </div>

                {authStatus?.connected && (
                  <div className="p-3 bg-secondary rounded-xl mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Icon name="ShieldCheck" size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Токен: <span className="font-mono">{authStatus.token_preview}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Действителен ещё {authStatus.expires_in_minutes} мин
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {authStatus?.connected && authStatus.user_id && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-secondary px-3 py-2 rounded-lg">
                    <Icon name="User" size={12} />
                    User ID: <span className="font-mono font-medium text-foreground">{authStatus.user_id}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Client ID</label>
                    <Input
                      placeholder="Например: a1b2c3d4e5f6..."
                      value={clientId}
                      onChange={(e) => { setClientId(e.target.value); setAuthError(""); setAuthSuccess(""); }}
                      className="bg-secondary border-0 focus-visible:ring-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Client Secret</label>
                    <Input
                      type="password"
                      placeholder="Секретный ключ приложения"
                      value={clientSecret}
                      onChange={(e) => { setClientSecret(e.target.value); setAuthError(""); setAuthSuccess(""); }}
                      className="bg-secondary border-0 focus-visible:ring-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      User ID{" "}
                      <span className="text-muted-foreground/60">(номер профиля Avito)</span>
                    </label>
                    <Input
                      placeholder="Например: 123456789"
                      value={userId}
                      onChange={(e) => { setUserId(e.target.value); setAuthError(""); setAuthSuccess(""); }}
                      className="bg-secondary border-0 focus-visible:ring-1 text-sm font-mono"
                      onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
                    />
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2.5 rounded-lg">
                      <Icon name="AlertCircle" size={13} />
                      {authError}
                    </div>
                  )}
                  {authSuccess && (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2.5 rounded-lg">
                      <Icon name="CheckCircle" size={13} />
                      {authSuccess}
                    </div>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={authLoading}
                    className="w-full h-9 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <>
                        <Icon name="Loader" size={14} className="animate-spin" />
                        Подключение...
                      </>
                    ) : (
                      <>
                        <Icon name="Plug" size={14} />
                        {authStatus?.connected ? "Переподключить" : "Подключить Avito"}
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  Client ID и Client Secret — в{" "}
                  <a href="https://www.avito.ru/professionals/api" target="_blank" rel="noreferrer" className="underline hover:text-foreground transition-colors">
                    личном кабинете Avito → API
                  </a>
                  . User ID — числовой номер вашего профиля (виден в URL страницы объявлений или в личном кабинете).
                </p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Синхронизация</h3>
                <div className="space-y-3">
                  {[
                    { label: "Автосинхронизация", sub: "При открытии раздела Чаты", active: true },
                    { label: "Уведомления о новых чатах", sub: "Push и email", active: true },
                    { label: "Архивировать старые чаты", sub: "Через 30 дней неактивности", active: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <div className="text-sm text-foreground">{s.label}</div>
                        <div className="text-xs text-muted-foreground">{s.sub}</div>
                      </div>
                      <button
                        className={`w-10 h-5 rounded-full relative transition-colors ${s.active ? "bg-foreground" : "bg-border"}`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-background shadow transition-all ${
                            s.active ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}