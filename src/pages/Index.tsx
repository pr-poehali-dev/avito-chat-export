import { useState } from "react";
import Icon from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

type Tab = "chats" | "stats" | "sync" | "settings";
type FilterStatus = "all" | "active" | "new" | "archived";

const MOCK_CHATS = [
  {
    id: 1,
    name: "Алексей Петров",
    item: "iPhone 14 Pro, 128GB",
    lastMsg: "Можно ли договориться о цене?",
    time: "14:32",
    unread: 3,
    status: "new",
    avatar: "А",
    avgResponseTime: "12 мин",
  },
  {
    id: 2,
    name: "Мария Сидорова",
    item: "MacBook Air M2",
    lastMsg: "Хорошо, завтра подъеду",
    time: "13:15",
    unread: 0,
    status: "active",
    avatar: "М",
    avgResponseTime: "5 мин",
  },
  {
    id: 3,
    name: "Дмитрий Козлов",
    item: "Sony PlayStation 5",
    lastMsg: "Готов забрать сегодня вечером",
    time: "11:48",
    unread: 1,
    status: "active",
    avatar: "Д",
    avgResponseTime: "28 мин",
  },
  {
    id: 4,
    name: "Анна Белова",
    item: "Диван угловой, серый",
    lastMsg: "Спасибо, уже нашла другой вариант",
    time: "Вчера",
    unread: 0,
    status: "archived",
    avatar: "А",
    avgResponseTime: "45 мин",
  },
  {
    id: 5,
    name: "Сергей Новиков",
    item: "Велосипед горный Trek",
    lastMsg: "Какой пробег?",
    time: "Вчера",
    unread: 2,
    status: "new",
    avatar: "С",
    avgResponseTime: "8 мин",
  },
  {
    id: 6,
    name: "Елена Волкова",
    item: "Холодильник Samsung",
    lastMsg: "Доставка включена?",
    time: "2 дня",
    unread: 0,
    status: "active",
    avatar: "Е",
    avgResponseTime: "15 мин",
  },
];

const MOCK_MESSAGES: Record<number, { from: "me" | "them"; text: string; time: string }[]> = {
  1: [
    { from: "them", text: "Добрый день! Интересует iPhone 14 Pro.", time: "14:20" },
    { from: "me", text: "Здравствуйте! Да, телефон ещё доступен.", time: "14:25" },
    { from: "them", text: "Можно ли договориться о цене?", time: "14:32" },
  ],
  2: [
    { from: "them", text: "Привет, MacBook ещё продаётся?", time: "12:50" },
    { from: "me", text: "Да, приходите смотреть!", time: "12:55" },
    { from: "them", text: "Хорошо, завтра подъеду", time: "13:15" },
  ],
  3: [
    { from: "them", text: "Здравствуйте, PS5 в наличии?", time: "11:30" },
    { from: "me", text: "Да, новая в упаковке.", time: "11:40" },
    { from: "them", text: "Готов забрать сегодня вечером", time: "11:48" },
  ],
  4: [
    { from: "them", text: "Диван ещё актуален?", time: "Вчера" },
    { from: "me", text: "Да, приходите смотреть.", time: "Вчера" },
    { from: "them", text: "Спасибо, уже нашла другой вариант", time: "Вчера" },
  ],
  5: [
    { from: "them", text: "Добрый день! Велосипед ещё доступен?", time: "Вчера" },
    { from: "me", text: "Да, всё в порядке!", time: "Вчера" },
    { from: "them", text: "Какой пробег?", time: "Вчера" },
  ],
  6: [
    { from: "them", text: "Холодильник продаёте?", time: "2 дня" },
    { from: "me", text: "Да, в отличном состоянии.", time: "2 дня" },
    { from: "them", text: "Доставка включена?", time: "2 дня" },
  ],
};

const SYNC_LOGS = [
  { id: 1, time: "14:35", event: "Синхронизация завершена", status: "ok", count: 3 },
  { id: 2, time: "14:05", event: "Получено новых сообщений", status: "ok", count: 7 },
  { id: 3, time: "13:30", event: "Синхронизация завершена", status: "ok", count: 0 },
  { id: 4, time: "12:00", event: "Ошибка соединения с Avito API", status: "error", count: 0 },
  { id: 5, time: "11:30", event: "Синхронизация завершена", status: "ok", count: 12 },
];

const STATUS_LABELS: Record<string, string> = {
  all: "Все",
  active: "Активные",
  new: "Новые",
  archived: "Архив",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  new: "bg-orange-100 text-orange-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function Index() {
  const [tab, setTab] = useState<Tab>("chats");
  const [selectedChat, setSelectedChat] = useState<number | null>(1);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const filteredChats = MOCK_CHATS.filter((c) => {
    const matchStatus = filter === "all" || c.status === filter;
    const matchSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.item.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMsg.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const activeChat = MOCK_CHATS.find((c) => c.id === selectedChat);
  const messages = selectedChat ? MOCK_MESSAGES[selectedChat] || [] : [];

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageSquare", label: "Чаты" },
    { id: "stats", icon: "BarChart3", label: "Статистика" },
    { id: "sync", icon: "RefreshCw", label: "История" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

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
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
              tab === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            title={item.label}
          >
            <Icon name={item.icon} fallback="Circle" size={18} />
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
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                  {MOCK_CHATS.reduce((a, c) => a + c.unread, 0)} новых
                </span>
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
                {(["all", "new", "active", "archived"] as FilterStatus[]).map((f) => (
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
              {filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                  <Icon name="Inbox" size={28} className="mb-2 opacity-30" />
                  Ничего не найдено
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat.id)}
                    className={`w-full text-left px-4 py-3 chat-item-hover border-b border-border/50 last:border-0 ${
                      selectedChat === chat.id ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                        {chat.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-medium text-foreground truncate">{chat.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{chat.time}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-1">{chat.item}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate flex-1">{chat.lastMsg}</span>
                          {chat.unread > 0 && (
                            <span className="ml-2 w-4 h-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center shrink-0">
                              {chat.unread}
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
                      {activeChat.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{activeChat.name}</div>
                      <div className="text-xs text-muted-foreground">{activeChat.item}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-lg ${STATUS_COLORS[activeChat.status]}`}>
                      {STATUS_LABELS[activeChat.status]}
                    </span>
                    <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Icon name="Clock" size={11} />
                      {activeChat.avgResponseTime}
                    </span>
                    <button className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors">
                      <Icon name="MoreHorizontal" size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-4 animate-fade-in">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.from === "me"
                            ? "bg-foreground text-background rounded-br-sm"
                            : "bg-card border border-border text-foreground rounded-bl-sm"
                        }`}
                      >
                        {msg.text}
                        <div className={`text-[10px] mt-1 ${msg.from === "me" ? "text-background/50" : "text-muted-foreground"}`}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 py-4 border-t border-border bg-card shrink-0">
                  <div className="flex gap-2 items-end">
                    <Input
                      placeholder="Написать сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 bg-secondary border-0 focus-visible:ring-1 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") setNewMessage(""); }}
                    />
                    <button
                      className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                      onClick={() => setNewMessage("")}
                    >
                      <Icon name="Send" size={15} />
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
            <p className="text-sm text-muted-foreground mb-8">Аналитика по чатам и активности</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { label: "Всего чатов", value: "6", icon: "MessageSquare", sub: "+2 за неделю" },
                { label: "Новых сообщений", value: "47", icon: "Bell", sub: "за последние 7 дней" },
                { label: "Среднее время ответа", value: "18 мин", icon: "Clock", sub: "улучшилось на 12%" },
                { label: "Активных чатов", value: "3", icon: "Activity", sub: "из 6 всего" },
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

            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-5">Активность по чатам</h3>
              <div className="space-y-3">
                {MOCK_CHATS.map((chat) => {
                  const msgs = MOCK_MESSAGES[chat.id]?.length || 0;
                  const pct = Math.round((msgs / 3) * 100);
                  return (
                    <div key={chat.id} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">
                        {chat.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground truncate">{chat.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{msgs} сообщ.</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground w-14 text-right shrink-0">{chat.avgResponseTime}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-5">Статусы чатов</h3>
              <div className="flex gap-6">
                {[
                  { label: "Активные", count: MOCK_CHATS.filter((c) => c.status === "active").length, color: "bg-emerald-500" },
                  { label: "Новые", count: MOCK_CHATS.filter((c) => c.status === "new").length, color: "bg-orange-500" },
                  { label: "Архив", count: MOCK_CHATS.filter((c) => c.status === "archived").length, color: "bg-gray-300" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-sm text-foreground">{s.label}</span>
                    <span className="text-sm font-semibold text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync tab */}
      {tab === "sync" && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-8 animate-fade-in">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-foreground">История синхронизации</h2>
              <button className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary hover:bg-border px-3 py-1.5 rounded-lg transition-colors">
                <Icon name="RefreshCw" size={13} />
                Синхронизировать
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-8">Последнее обновление: сегодня в 14:35</p>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {SYNC_LOGS.map((log, i) => (
                <div
                  key={log.id}
                  className={`flex items-center gap-4 px-5 py-4 ${i < SYNC_LOGS.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      log.status === "ok" ? "bg-emerald-50" : "bg-red-50"
                    }`}
                  >
                    <Icon
                      name={log.status === "ok" ? "CheckCircle" : "XCircle"}
                      size={15}
                      className={log.status === "ok" ? "text-emerald-600" : "text-red-500"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{log.event}</div>
                    {log.count > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">{log.count} сообщений</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{log.time}</div>
                </div>
              ))}
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
                <h3 className="text-sm font-semibold text-foreground mb-4">Аккаунт Avito</h3>
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl mb-4">
                  <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-background font-semibold">
                    П
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Пользователь Avito</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Подключено
                    </div>
                  </div>
                </div>
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Icon name="Link" size={13} />
                  Переподключить аккаунт
                </button>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Синхронизация</h3>
                <div className="space-y-3">
                  {[
                    { label: "Автосинхронизация", sub: "Каждые 5 минут", active: true },
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

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-foreground mb-1">API-токен</h3>
                <p className="text-xs text-muted-foreground mb-4">Используется для подключения к Avito API</p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    defaultValue="avito_api_xxxxxxxxxxxxxxxx"
                    className="flex-1 bg-secondary border-0 text-sm font-mono"
                    readOnly
                  />
                  <button className="px-3 h-9 rounded-lg bg-secondary hover:bg-border text-sm text-foreground transition-colors">
                    <Icon name="Copy" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}