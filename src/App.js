import { useState, useRef, useEffect } from "react";

// ブランドカラー
const DEFAULT_STORES = [
  { id: "muji", name: "無印良品", emoji: "🏷️", color: "#7F0019" },
  { id: "kaldi", name: "カルディ", emoji: "☕", color: "#003087", textColor: "#FFD900" },
  { id: "seijo", name: "成城石井", emoji: "🍷", color: "#B01757" },
  { id: "supermarket", name: "スーパー", emoji: "🛒", color: "#2d6a4f" },
  { id: "pharmacy", name: "薬局", emoji: "💊", color: "#b5451b" },
  { id: "hyaku", name: "100均", emoji: "💴", color: "#7b5ea7" },
  { id: "other", name: "その他", emoji: "🏪", color: "#4a6274" },
];

const STORE_COLORS = ["#B5A99A","#006241","#8B1A1A","#2d6a4f","#b5451b","#7b5ea7","#4a6274","#c77dff","#f4a261","#219ebc"];

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

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

const EMPTY_FORM = { name: "", url: "", note: "", price: "", date: "", storeId: "auto" };

export default function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("shopping-items");
    return saved ? JSON.parse(saved) : [];
  });
  const [stores, setStores] = useState(() => {
    const saved = localStorage.getItem("shopping-stores");
    return saved ? JSON.parse(saved) : DEFAULT_STORES;
  });
  const [checkedItems, setCheckedItems] = useState(() => {
    const saved = localStorage.getItem("shopping-checked");
    return saved ? JSON.parse(saved) : {};
  });

  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingEmoji, setEditingEmoji] = useState("");
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreEmoji, setNewStoreEmoji] = useState("🏬");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedItem, setExpandedItem] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [bannerDismissed, setBannerDismissed] = useState({});
  const nameRef = useRef(null);

  // localStorage同期
  useEffect(() => { localStorage.setItem("shopping-items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("shopping-stores", JSON.stringify(stores)); }, [stores]);
  useEffect(() => { localStorage.setItem("shopping-checked", JSON.stringify(checkedItems)); }, [checkedItems]);

  // 期限バナー
  const urgentItems = items.filter((item) => {
    if (!item.date || checkedItems[item.id] || bannerDismissed[item.id]) return false;
    const days = getDaysUntil(item.date);
    return days !== null && days <= 3 && days >= 0;
  });

  const setFormField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setEditField = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const handleAddItem = async () => {
    const name = form.name.trim();
    if (!name) return;
    setLoading(true);
    let storeId = form.storeId;
    if (storeId === "auto") {
      storeId = await aiClassifyItem(name, stores);
    }
    setItems((prev) => [...prev, {
      id: Date.now(), name, storeId,
      url: form.url.trim() || null,
      note: form.note.trim() || null,
      price: form.price.trim() || null,
      date: form.date || null,
    }]);
    setForm(EMPTY_FORM);
    setShowAddForm(false);
    setLoading(false);
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditForm({
      name: item.name,
      url: item.url || "",
      note: item.note || "",
      price: item.price || "",
      date: item.date || "",
      storeId: item.storeId,
    });
    setExpandedItem(null);
  };

  const saveEditItem = async () => {
    const name = editForm.name.trim();
    if (!name) return;
    setLoading(true);
    let storeId = editForm.storeId;
    if (storeId === "auto") {
      storeId = await aiClassifyItem(name, stores);
    }
    setItems((prev) => prev.map((i) => i.id === editingItemId ? {
      ...i, name, storeId,
      url: editForm.url.trim() || null,
      note: editForm.note.trim() || null,
      price: editForm.price.trim() || null,
      date: editForm.date || null,
    } : i));
    setEditingItemId(null);
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

  const startEditStore = (store) => {
    setEditingStoreId(store.id);
    setEditingName(store.name);
    setEditingEmoji(store.emoji);
  };

  const saveEditStore = () => {
    if (!editingName.trim()) return;
    setStores((prev) => prev.map((s) => s.id === editingStoreId ? { ...s, name: editingName.trim(), emoji: editingEmoji } : s));
    setEditingStoreId(null);
  };

  const displayedItems = activeTab === "all" ? items : items.filter((i) => i.storeId === activeTab);
  const countFor = (storeId) => items.filter((i) => i.storeId === storeId).length;

  // フォームUI共通
  const renderForm = (f, setF, onSubmit, onCancel, submitLabel) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* 商品名 */}
      <div>
        <div style={labelStyle}>商品名 *</div>
        <input ref={submitLabel === "リストに追加" ? nameRef : null} value={f.name} onChange={(e) => setF("name", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="例: オリーブオイル エキストラバージン"
          style={inputStyle} />
      </div>
      {/* お店 */}
      <div>
        <div style={labelStyle}>お店</div>
        <select value={f.storeId} onChange={(e) => setF("storeId", e.target.value)} style={inputStyle}>
          <option value="auto">🤖 AIに自動で振り分けてもらう</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
        </select>
      </div>
      {/* 価格 */}
      <div>
        <div style={labelStyle}>価格（任意）</div>
        <input value={f.price} onChange={(e) => setF("price", e.target.value)}
          placeholder="例: ¥1,280"
          style={inputStyle} />
      </div>
      {/* 発売日 */}
      <div>
        <div style={labelStyle}>発売日・購入期限（任意）</div>
        <input type="date" value={f.date} onChange={(e) => setF("date", e.target.value)} style={inputStyle} />
      </div>
      {/* メモ */}
      <div>
        <div style={labelStyle}>メモ（任意）</div>
        <input value={f.note} onChange={(e) => setF("note", e.target.value)}
          placeholder="例: Lサイズ、赤いパッケージ..."
          style={inputStyle} />
      </div>
      {/* 参考URL */}
      <div>
        <div style={labelStyle}>参考URL（任意）</div>
        <input value={f.url} onChange={(e) => setF("url", e.target.value)}
          placeholder="https://..."
          style={inputStyle} />
      </div>
      {/* ボタン */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSubmit} disabled={loading || !f.name.trim()}
          style={{ flex: 1, background: loading || !f.name.trim() ? "#ccc" : "#1a1a2e", color: loading || !f.name.trim() ? "#fff" : "#f5c842", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 15, fontWeight: 700, cursor: loading || !f.name.trim() ? "default" : "pointer" }}>
          {loading ? "処理中…" : submitLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} style={{ background: "none", border: "1.5px solid #ddd", borderRadius: 12, padding: "11px 16px", fontSize: 14, cursor: "pointer", color: "#888" }}>
            取消
          </button>
        )}
      </div>
    </div>
  );

  const labelStyle = { fontSize: 12, color: "#888", marginBottom: 4 };
  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #ddd", fontSize: 14, boxSizing: "border-box", background: "#fff" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f5f0e8 0%, #ebe4d8 100%)", fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif", paddingBottom: 80 }}>

      {/* 期限バナー */}
      {urgentItems.map((item) => {
        const days = getDaysUntil(item.date);
        return (
          <div key={item.id} style={{ background: days === 0 ? "#e76f51" : "#f4a261", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
            <span>⏰ 「{item.name}」{days === 0 ? "が今日発売！" : `まであと${days}日！`}</span>
            <button onClick={() => setBannerDismissed(p => ({ ...p, [item.id]: true }))} style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
        );
      })}

      {/* ヘッダー */}
      <div style={{ background: "#1a1a2e", padding: "18px 16px 14px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ color: "#f5c842", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 2 }}>Shopping List</div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>🛍️ お買い物リスト</div>
          </div>
          <button onClick={() => { setShowStoreManager(!showStoreManager); setShowAddForm(false); setEditingItemId(null); }}
            style={{ background: showStoreManager ? "#f5c842" : "rgba(255,255,255,0.1)", color: showStoreManager ? "#1a1a2e" : "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            ⚙️ お店管理
          </button>
        </div>
        <button onClick={() => { setShowAddForm(!showAddForm); setShowStoreManager(false); setEditingItemId(null); }}
          style={{ background: "#f5c842", color: "#1a1a2e", border: "none", borderRadius: 12, padding: "11px 0", fontSize: 15, cursor: "pointer", fontWeight: 700, width: "100%" }}>
          {showAddForm ? "✕ 閉じる" : "+ 商品を追加"}
        </button>
      </div>

      {/* 商品追加フォーム */}
      {showAddForm && (
        <div style={{ background: "#fff", margin: "12px 16px", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1a1a2e" }}>商品を追加</div>
          {renderForm(form, setFormField, handleAddItem, null, "リストに追加")}
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
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEditStore()} autoFocus style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${store.color}`, fontSize: 14 }} />
                    <button onClick={saveEditStore} style={{ background: store.color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>保存</button>
                    <button onClick={() => setEditingStoreId(null)} style={{ background: "none", border: "1.5px solid #ccc", color: "#888", borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>取消</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: store.color + "18", border: `1.5px solid ${store.color}`, borderRadius: 12, padding: "8px 10px" }}>
                    <span style={{ fontSize: 16 }}>{store.emoji}</span>
                    <span style={{ color: store.color, fontWeight: 600, fontSize: 14, flex: 1 }}>{store.name}</span>
                    <button onClick={() => startEditStore(store)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>✏️</button>
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
              flexShrink: 0,
              background: store.color,
              color: store.textColor || "#fff",
              border: "none",
              borderRadius: 20, padding: "7px 13px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              opacity: active ? 1 : (count === 0 ? 0.3 : 0.55),
              boxShadow: active ? `0 3px 10px ${store.color}66` : "none",
              transform: active ? "scale(1.05)" : "scale(1)",
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
            const isEditing = editingItemId === item.id;
            const days = getDaysUntil(item.date);
            const isUrgent = days !== null && days <= 3 && days >= 0;

            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: 14, marginBottom: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderLeft: `4px solid ${store?.color || "#ccc"}`, opacity: checked ? 0.5 : 1, transition: "opacity 0.2s", overflow: "hidden" }}>

                {isEditing ? (
                  // 編集モード
                  <div style={{ padding: "14px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: "#1a1a2e" }}>商品を編集</div>
                    {renderForm(editForm, setEditField, saveEditItem, () => setEditingItemId(null), "保存")}
                  </div>
                ) : (
                  <>
                    {/* メイン行 */}
                    <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => toggleCheck(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${store?.color || "#ccc"}`, background: checked ? store?.color : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}>
                        {checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1a2e", textDecoration: checked ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.name}
                          {item.price && <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{item.price}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                          {item.date && (
                            <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: isUrgent ? "#e76f51" : "#eee", color: isUrgent ? "#fff" : "#888", fontWeight: 600 }}>
                              📅 {item.date}{days === 0 ? " 今日！" : days > 0 ? ` (あと${days}日)` : " 過去"}
                            </span>
                          )}
                          {item.url && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#e8f4fd", color: "#2980b9", fontWeight: 600 }}>🔗 URL</span>}
                          {item.note && <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#f0f0f0", color: "#666" }}>📝 {item.note}</span>}
                        </div>
                      </div>

                      <select value={item.storeId} onChange={(e) => changeStore(item.id, e.target.value)} style={{ border: `1.5px solid ${store?.color || "#ccc"}`, borderRadius: 8, padding: "4px 6px", fontSize: 11, color: store?.color, fontWeight: 600, background: (store?.color || "#ccc") + "15", cursor: "pointer", outline: "none", flexShrink: 0 }}>
                        {stores.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
                      </select>

                      <button onClick={() => startEditItem(item)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", padding: "0 2px", color: "#aaa" }}>✏️</button>

                      {(item.url || item.note) && (
                        <button onClick={() => setExpandedItem(expanded ? null : item.id)} style={{ background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", padding: "0 2px" }}>
                          {expanded ? "▲" : "▼"}
                        </button>
                      )}

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
                  </>
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