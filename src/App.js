import { useState, useRef } from "react";

const DEFAULT_STORES = [
  { id: "muji", name: "無印良品", emoji: "🏷️", color: "#8b7355" },
  { id: "kaldi", name: "カルディ", emoji: "☕", color: "#c0392b" },
  { id: "supermarket", name: "スーパー", emoji: "🛒", color: "#2d6a4f" },
  { id: "pharmacy", name: "薬局", emoji: "💊", color: "#b5451b" },
  { id: "hyaku", name: "100均", emoji: "💴", color: "#7b5ea7" },
  { id: "other", name: "その他", emoji: "🏪", color: "#4a6274" },
];

const STORE_COLORS = ["#8b7355","#c0392b","#2d6a4f","#b5451b","#7b5ea7","#4a6274","#c77dff","#f4a261","#219ebc","#e76f51"];

async function aiClassifyItem(name, stores) {
  const storeList = stores.map((s) => s.name).join("、");
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `次のお店リスト「${storeList}」から、「${name}」を買うのに最もふさわしいお店を1つ選んでください。お店名だけを返してください。`,
        }],
      }),
    });
    const data = await response.json();
    const result = data.content?.[0]?.text?.trim() || "";
    const matched = stores.find((s) => result.includes(s.name));
    return matched ? matched.id : "other";
  } catch {
    return "other";
  }
}

async function fetchTitleFromUrl(url) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `このURL「${url}」のページにある商品名を短く教えてください。商品名だけを返してください。`,
        }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export default function App() {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState(DEFAULT_STORES);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmoji, setEditingEmoji] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreEmoji, setNewStoreEmoji] = useState("🏬");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStoreId, setFormStoreId] = useState("other");
  const [expandedItem, setExpandedItem] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState({});
  const inputRef = useRef(null);

  // 期限バナーチェック
  const urgentItems = items.filter((item) => {
    if (!item.releaseDate || checkedItems[item.id] || bannerDismissed[item.id]) return false;
    const days = getDaysUntil(item.releaseDate);
    return days !== null && days <= 3 && days >= 0;
  });

  const handleUrlBlur = async () => {
    const url = formUrl.trim();
    if (!url || !url.startsWith("http")) return;
    if (formName) return; // 既に名前があれば取得しない
    setLoadingUrl(true);
    const title = await fetchTitleFromUrl(url);
    if (title) setFormName(title);
    setLoadingUrl(false);
  };

  const handleAddItem = async () => {
    const name = formName.trim();
    if (!name) return;
    setLoading(true);

    let storeId = formStoreId;
    if (storeId === "auto") {
      storeId = await aiClassifyItem(name, stores);
    }

    setItems((prev) => [...prev, {
      id: Date.now(),
      name,
      storeId,
      url: formUrl.trim() || null,
      note: formNote.trim() || null,
      releaseDate: formDate || null,
    }]);

    setFormName(""); setFormUrl(""); setFormNote(""); setFormDate("");
    setFormStoreId("auto");
    setShowAddForm(false);
    setLoading(false);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCheckedItems((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const changeStore = (itemId, storeId) => {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, storeId } : i));
  };

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addStore = () => {
    const name = newStoreName.trim();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    const color = STORE_COLORS[stores.length % STORE_COLORS.length];
    setStores((prev) => [...prev, { id, name, emoji: newStoreEmoji, color }]);
    setNewStoreName(""); setNewStoreEmoji("🏬");
  };

  const removeStore = (id) => {
    if (id === "other") return;
    setStores((prev) => prev.filter((s) => s.id !== id));
    setItems((prev) => prev.map((i) => i.storeId === id ? { ...i, storeId: "other" } : i));
  };

  const startEdit = (store) => {
    setEditingStoreId(store.id);
    setEditingName(store.name);
    setEditingEmoji(store.emoji);
  };

  const saveEdit = () => {
    if (!editingName.trim()) return;
    setStores((prev) => prev.map((s) => s.id === editingStoreId ? { ...s, name: editingName.trim(), emoji: editingEmoji } : s));
    setEditingStoreId(null);
  };

  const displayedItems = activeTab === "all" ? items : items.filter((i) => i.storeId === activeTab);
  const countFor = (storeId) => items.filter((i) => i.storeId === storeId).length;

  const S = {
    app: { minHeight: "100vh", background: "linear-gradient(135deg, #f5f0e8 0%, #ebe4d8 100%)", fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif", paddingBottom: 80 },
    header: { background: "#1a1a2e", padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" },
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    label: { color: "#f5c842", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 },
    title: { color: "#fff", fontSize: 20, fontWeight: 700 },
    gearBtn: (active) => ({ background: active ? "#f5c842" : "rgba(255,255,255,0.1)", color: active ? "#1a1a2e" : "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }),
    addBtn: { background: "#f5c842", color: "#1a1a2e", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 15, cursor: "pointer", fontWeight: 700, width: "100%", marginTop: 4 },
  };

  return (
    <div style={S.app}>
      {/* 期限バナー */}
      {urgentItems.map((item) => {
        const days = getDaysUntil(item.releaseDate);
        return (
          <div key={item.id} style={{
            background: days === 0 ? "#e76f51" : "#f4a261",
            color: "#fff", padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 13, fontWeight: 600,
          }}>
            <span>⏰ 「{item.name}」{days === 0 ? "が今日発売！" : `まであと${days}日！`}</span>
            <button onClick={() => setBannerDismissed(p => ({ ...p, [item.id]: true }))}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
        );
      })}

      {/* ヘッダー */}
      <div style={S.header}>
        <div style={S.headerRow}>
          <div>
            <div style={S.label}>Shopping List</div>
            <div style={S.title}>🛍️ お買い物リスト</div>
          </div>
          <button style={S.gearBtn(showStoreManager)} onClick={() => { setShowStoreManager(!showStoreManager); setShowAddForm(false); }}>⚙️ お店管理</button>
        </div>
        <button style={S.addBtn} onClick={() => { setShowAddForm(!showAddForm); setShowStoreManager(false); }}>
          {showAddForm ? "✕ 閉じる" : "+ 商品を追加"}
        </button>
      </div>

      {/* 商品追加フォーム */}
      {showAddForm && (
        <div style={{ background: "#fff", margin: "12px 16px", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1a1a2e" }}>商品を追加</div>

          {/* URL入力 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>参考URL（貼ると商品名を自動取得）</div>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://..."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box" }}
            />
            {loadingUrl && <div style={{ fontSize: 12, color: "#f5c842", marginTop: 4 }}>🔍 商品名を取得中…</div>}
          </div>

          {/* 商品名 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>商品名 *</div>
            <input
              ref={inputRef}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              placeholder="例: オリーブオイル エキストラバージン"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {/* お店選択 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>お店</div>
            <select
              value={formStoreId}
              onChange={(e) => setFormStoreId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box" }}
            >
              <option value="auto">🤖 AIに自動で振り分けてもらう</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>

          {/* 発売日 */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>発売日・購入期限（任意）</div>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {/* メモ */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>メモ（任意）</div>
            <input
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="例: Lサイズ、赤いパッケージ..."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          <button
            onClick={handleAddItem}
            disabled={loading || !formName.trim()}
            style={{ background: loading || !formName.trim() ? "#ccc" : "#1a1a2e", color: loading || !formName.trim() ? "#fff" : "#f5c842", border: "none", borderRadius: 12, padding: "11px 0", width: "100%", fontSize: 15, fontWeight: 700, cursor: loading || !formName.trim() ? "default" : "pointer" }}
          >{loading ? "追加中…" : "リストに追加"}</button>
        </div>
      )}

      {/* お店管理 */}
      {showStoreManager && (
        <div style={{ background: "#fff", margin: "12px 16px", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1a1a2e" }}>お店の管理</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {stores.map((store) => (
              <div key={store.id}>
                {editingStoreId === store.id ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input value={editingEmoji} onChange={(e) => setEditingEmoji(e.target.value)} style={{ width: 38, padding: 6, borderRadius: 8, border: `1.5px solid ${store.color}`, fontSize: 16, textAlign: "center" }} maxLength={2} />
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${store.color}`, fontSize: 14 }} />
                    <button onClick={saveEdit} style={{ background: store.color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>保存</button>
                    <button onClick={() => setEditingStoreId(null)} style={{ background: "none", border: "1.5px solid #ccc", color: "#888", borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>取消</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: store.color + "18", border: `1.5px solid ${store.color}`, borderRadius: 12, padding: "8px 10px" }}>
                    <span style={{ fontSize: 16 }}>{store.emoji}</span>
                    <span style={{ color: store.color, fontWeight: 600, fontSize: 14, flex: 1 }}>{store.name}</span>
                    <button onClick={() => startEdit(store)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✏️</button>
                    {store.id !== "other" && <button onClick={() => removeStore(store.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px", color: "#aaa" }}>✕</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={newStoreEmoji} onChange={(e) => setNewStoreEmoji(e.target.value)} style={{ width: 38, padding: 8, borderRadius: 8, border: "1.5px solid #ddd", fontSize: 16, textAlign: "center" }} maxLength={2} />
            <input value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStore()} placeholder="新しいお店を追加" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #ddd", fontSize: 14 }} />
            <button onClick={addStore} disabled={!newStoreName.trim()} style={{ background: "#1a1a2e", color: "#f5c842", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>追加</button>
          </div>
        </div>
      )}

      {/* タブ */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px", overflowX: "auto", scrollbarWidth: "none" }}>
        {[{ id: "all", name: "すべて", emoji: "📋", color: "#1a1a2e" }, ...stores].map((store) => {
          const count = store.id === "all" ? items.length : countFor(store.id);
          const active = activeTab === store.id;
          return (
            <button key={store.id} onClick={() => setActiveTab(store.id)} style={{
              flexShrink: 0, background: active ? store.color : "#fff",
              color: active ? (store.id === "all" ? "#f5c842" : "#fff") : store.color,
              border: store.id === "all" ? "none" : `1.5px solid ${store.color}`,
              borderRadius: 20, padding: "7px 13px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              opacity: count === 0 && store.id !== "all" ? 0.4 : 1,
              boxShadow: store.id === "all" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
            }}>
              {store.emoji} {store.name} <span style={{ opacity: 0.75 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* アイテムリスト */}
      <div style={{ padding: "8px 16px 0" }}>
        {displayedItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#aaa", fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
            まだアイテムがありません<br />
            <span style={{ fontSize: 12 }}>「+ 商品を追加」から追加してみましょう</span>
          </div>
        ) : (
          displayedItems.map((item) => {
            const store = stores.find((s) => s.id === item.storeId) || stores.find(s => s.id === "other");
            const checked = !!checkedItems[item.id];
            const expanded = expandedItem === item.id;
            const days = getDaysUntil(item.releaseDate);
            const isUrgent = days !== null && days <= 3 && days >= 0;

            return (
              <div key={item.id} style={{
                background: "#fff", borderRadius: 14, marginBottom: 8,
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${store?.color || "#ccc"}`,
                opacity: checked ? 0.5 : 1, transition: "opacity 0.2s",
                overflow: "hidden",
              }}>
                {/* メイン行 */}
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  {/* チェック */}
                  <button onClick={() => toggleCheck(item.id)} style={{
                    width: 24, height: 24, borderRadius: "50%",
                    border: `2px solid ${store?.color || "#ccc"}`,
                    background: checked ? store?.color : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, padding: 0,
                  }}>
                    {checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </button>

                  {/* 商品名＋バッジ */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a2e", textDecoration: checked ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.name}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                      {item.releaseDate && (
                        <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: isUrgent ? "#e76f51" : "#eee", color: isUrgent ? "#fff" : "#888", fontWeight: 600 }}>
                          📅 {item.releaseDate}{days === 0 ? " 今日！" : days > 0 ? ` (あと${days}日)` : " 過去"}
                        </span>
                      )}
                      {item.url && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#e8f4fd", color: "#2980b9", fontWeight: 600 }}>🔗 URL</span>}
                      {item.note && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#f0f0f0", color: "#666" }}>📝 {item.note}</span>}
                    </div>
                  </div>

                  {/* お店変更 */}
                  <select value={item.storeId} onChange={(e) => changeStore(item.id, e.target.value)} style={{
                    border: `1.5px solid ${store?.color || "#ccc"}`, borderRadius: 8, padding: "4px 6px",
                    fontSize: 11, color: store?.color, fontWeight: 600, background: (store?.color || "#ccc") + "15",
                    cursor: "pointer", outline: "none", flexShrink: 0,
                  }}>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                  </select>

                  {/* 展開 */}
                  {(item.url || item.note) && (
                    <button onClick={() => setExpandedItem(expanded ? null : item.id)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", padding: "0 2px" }}>
                      {expanded ? "▲" : "▼"}
                    </button>
                  )}

                  {/* 削除 */}
                  <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#ccc", fontSize: 16, cursor: "pointer", padding: "0 2px" }}>✕</button>
                </div>

                {/* 展開パネル */}
                {expanded && (
                  <div style={{ borderTop: "1px solid #f0f0f0", padding: "10px 14px 12px", background: "#fafafa" }}>
                    {item.url && (
                      <div style={{ marginBottom: item.note ? 8 : 0 }}>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>参考URL</div>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#2980b9", wordBreak: "break-all" }}>{item.url}</a>
                      </div>
                    )}
                    {item.note && (
                      <div>
                        <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>メモ</div>
                        <div style={{ fontSize: 13, color: "#444" }}>{item.note}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* チェック済み削除 */}
      {Object.values(checkedItems).some(Boolean) && (
        <div style={{ padding: "8px 16px 0", textAlign: "right" }}>
          <button onClick={() => {
            const ids = Object.entries(checkedItems).filter(([, v]) => v).map(([k]) => Number(k));
            setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
            setCheckedItems({});
          }} style={{ background: "none", border: "1.5px solid #e76f51", color: "#e76f51", borderRadius: 10, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            ✓ チェック済みを削除
          </button>
        </div>
      )}
    </div>
  );
}