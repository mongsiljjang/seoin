"use client";

import { useMemo, useState } from "react";

type Role = "staff" | "admin";
type View = "home" | "schedule" | "patients" | "packages" | "inventory" | "attendance" | "settings";

const navItems: { id: View; icon: string; label: string }[] = [
  { id: "home", icon: "⌂", label: "홈" },
  { id: "schedule", icon: "▦", label: "예약·진료" },
  { id: "patients", icon: "♙", label: "고객 관리" },
  { id: "packages", icon: "◇", label: "패키지" },
  { id: "inventory", icon: "▣", label: "재고 관리" },
  { id: "attendance", icon: "◷", label: "근태 관리" },
  { id: "settings", icon: "⚙", label: "설정" },
];

const initialInventory = [
  { id: 1, category: "시술 재료", name: "리쥬란 HB Plus", lot: "RJ260715", stock: 8, safe: 10, unit: "box", expiry: "2026.09.18", state: "low" },
  { id: 2, category: "주사·소모품", name: "1cc 주사기", lot: "SY260601", stock: 42, safe: 30, unit: "개", expiry: "2028.02.11", state: "ok" },
  { id: 3, category: "시술 재료", name: "보톡스 100U", lot: "BT260401", stock: 6, safe: 5, unit: "vial", expiry: "2026.08.28", state: "expiry" },
  { id: 4, category: "판매 제품", name: "재생 크림 50ml", lot: "CR260508", stock: 18, safe: 12, unit: "개", expiry: "2027.03.02", state: "ok" },
  { id: 5, category: "위생 용품", name: "멸균 거즈 4×4", lot: "GZ260620", stock: 24, safe: 20, unit: "pack", expiry: "2029.06.20", state: "ok" },
  { id: 6, category: "시술 재료", name: "히알루론산 필러 1ml", lot: "FL260312", stock: 3, safe: 6, unit: "box", expiry: "2026.10.09", state: "low" },
];

const notices = [
  { tone: "red", title: "유효기간 임박", text: "보톡스 100U · 17일 남음", action: "우선 사용" },
  { tone: "orange", title: "안전재고 미만", text: "리쥬란 HB Plus 외 1개", action: "발주 요청" },
  { tone: "blue", title: "오늘 입고 예정", text: "멸균 니들 외 2개", action: "입고 확인" },
];

function InventoryView({ role }: { role: Role }) {
  const [inventory, setInventory] = useState(initialInventory);
  const [filter, setFilter] = useState<"all" | "low" | "expiry">("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"in" | "out" | null>(null);
  const [selectedId, setSelectedId] = useState(initialInventory[0].id);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState("");

  const filtered = useMemo(() => inventory.filter((item) => {
    const matchesFilter = filter === "all" || item.state === filter;
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase()) || item.lot.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  }), [inventory, filter, query]);

  const submitMovement = () => {
    const chosen = inventory.find((item) => item.id === selectedId);
    if (!chosen || quantity < 1) return;
    if (modal === "out" && chosen.stock < quantity) {
      setToast("현재 재고보다 많은 수량은 사용할 수 없습니다.");
      return;
    }
    setInventory((items) => items.map((item) => {
      if (item.id !== selectedId) return item;
      const nextStock = modal === "in" ? item.stock + quantity : item.stock - quantity;
      return {
        ...item,
        stock: nextStock,
        state: item.state === "expiry" ? "expiry" : nextStock < item.safe ? "low" : "ok",
      };
    }));
    setToast(`${chosen.name} ${quantity}${chosen.unit} ${modal === "in" ? "입고" : "사용"} 처리되었습니다.`);
    setModal(null);
    setTimeout(() => setToast(""), 2600);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h1>재고 관리</h1>
          <p className="page-description">필요한 재료를 놓치지 않도록 수량과 유효기간을 한눈에 확인하세요.</p>
        </div>
        <div className="heading-actions">
          <button className="button secondary" onClick={() => setModal("out")}>− 사용 등록</button>
          <button className="button primary" onClick={() => setModal("in")}>＋ 입고 등록</button>
        </div>
      </div>

      <section className="alert-grid" aria-label="재고 알림">
        {notices.map((notice) => (
          <article className={`notice ${notice.tone}`} key={notice.title}>
            <div className="notice-icon">{notice.tone === "red" ? "!" : notice.tone === "orange" ? "↓" : "↘"}</div>
            <div className="notice-copy"><strong>{notice.title}</strong><span>{notice.text}</span></div>
            <button>{notice.action} ›</button>
          </article>
        ))}
      </section>

      {role === "admin" && (
        <section className="admin-strip">
          <div><span>총 재고 자산</span><strong>₩ 18,460,000</strong></div>
          <div><span>이번 달 매입</span><strong>₩ 3,250,000</strong></div>
          <div><span>폐기 예상 손실</span><strong className="danger-text">₩ 420,000</strong></div>
          <button>거래처·원가 관리 →</button>
        </section>
      )}

      <section className="inventory-panel">
        <div className="panel-top">
          <div className="tabs" role="tablist" aria-label="재고 필터">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>전체 <b>{inventory.length}</b></button>
            <button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}>안전재고 미만 <b>{inventory.filter((item) => item.state === "low").length}</b></button>
            <button className={filter === "expiry" ? "active" : ""} onClick={() => setFilter("expiry")}>유효기간 임박 <b>{inventory.filter((item) => item.state === "expiry").length}</b></button>
          </div>
          <label className="search"><span>⌕</span><input aria-label="재고 검색" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="품목명 또는 LOT 검색" /></label>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>품목</th><th>LOT 번호</th><th>현재 재고</th><th>안전재고</th><th>유효기간</th><th>상태</th>{role === "admin" && <th>관리</th>}</tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td><div className="product-cell"><span className="product-icon">{item.category === "판매 제품" ? "▤" : "✣"}</span><div><strong>{item.name}</strong><small>{item.category}</small></div></div></td>
                  <td className="mono">{item.lot}</td>
                  <td><strong className={item.stock < item.safe ? "danger-text" : ""}>{item.stock}</strong> <span className="muted">{item.unit}</span></td>
                  <td>{item.safe} <span className="muted">{item.unit}</span></td>
                  <td>{item.expiry}</td>
                  <td>{item.state === "low" ? <span className="pill orange">부족</span> : item.state === "expiry" ? <span className="pill red">임박</span> : <span className="pill green">정상</span>}</td>
                  {role === "admin" && <td><button className="more" aria-label={`${item.name} 관리`}>•••</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty">조건에 맞는 재고가 없습니다.</div>}
        </div>
        <div className="panel-footer"><span>직원 모드에서는 수량·유효기간·입출고만 표시됩니다.</span><button>입출고 기록 보기 →</button></div>
      </section>

      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label={modal === "in" ? "입고 등록" : "사용 등록"} onMouseDown={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <p className="eyebrow">STOCK MOVEMENT</p>
            <h2>{modal === "in" ? "입고 등록" : "사용 등록"}</h2>
            <label>품목<select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>{inventory.map((item) => <option key={item.id} value={item.id}>{item.name} · 현재 {item.stock}{item.unit}</option>)}</select></label>
            <label>수량<input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /></label>
            <label>메모<input placeholder={modal === "in" ? "예: 정기 발주 입고" : "예: 3번 시술실 사용"} /></label>
            <div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>취소</button><button className="button primary" onClick={submitMovement}>등록 완료</button></div>
          </div>
        </div>
      )}
      {toast && <div className="toast">✓ {toast}</div>}
    </>
  );
}

function HomeView({ setView }: { setView: (view: View) => void }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">TODAY · 08.11</p><h1>좋은 아침이에요, 김다은 님</h1><p className="page-description">오늘의 진료와 운영 현황을 확인하세요.</p></div><button className="button primary">＋ 새 예약</button></div>
      <section className="summary-grid">
        <article><span>오늘 예약</span><strong>24<small>명</small></strong><em>대기 3명</em></article>
        <article><span>상담 예정</span><strong>7<small>건</small></strong><em>완료 2건</em></article>
        <article className="clickable" onClick={() => setView("inventory")}><span>재고 알림</span><strong className="danger-text">3<small>건</small></strong><em>지금 확인하기 →</em></article>
        <article><span>근무 상태</span><strong>정상</strong><em>08:47 출근</em></article>
      </section>
      <section className="home-columns">
        <article className="card"><div className="card-title"><div><p className="eyebrow">SCHEDULE</p><h2>오늘 예약</h2></div><button>전체 보기 →</button></div>{["09:30 · 박서연 · 리쥬란", "10:20 · 이민지 · 피부 상담", "11:00 · 정우성 · 보톡스", "13:40 · 최하나 · 필러 리터치"].map((row, index) => <div className="schedule-row" key={row}><span>{index + 1}</span><strong>{row}</strong><i className={index < 2 ? "done" : ""}>{index < 2 ? "내원" : "예정"}</i></div>)}</article>
        <article className="card"><div className="card-title"><div><p className="eyebrow">QUICK ACTION</p><h2>빠른 업무</h2></div></div><div className="quick-grid"><button onClick={() => setView("inventory")}><b>▣</b>재고 확인<span>부족 2건</span></button><button><b>◇</b>패키지 차감<span>잔액 확인</span></button><button><b>◷</b>근태 기록<span>정상 출근</span></button><button><b>♙</b>고객 검색<span>빠른 조회</span></button></div></article>
      </section>
    </>
  );
}

function PlaceholderView({ title }: { title: string }) {
  return <><div className="page-heading"><div><p className="eyebrow">CLINIC OPERATIONS</p><h1>{title}</h1><p className="page-description">업무 정보를 빠르고 정확하게 관리하세요.</p></div><button className="button primary">＋ 새로 등록</button></div><section className="card placeholder"><div className="placeholder-icon">✦</div><h2>{title} 화면</h2><p>핵심 기능을 사용할 수 있도록 준비된 업무 화면입니다.</p></section></>;
}

export default function Home() {
  const [role, setRole] = useState<Role>("staff");
  const [view, setView] = useState<View>("inventory");
  const visibleNav = navItems.filter((item) => !(role === "staff" && item.id === "settings"));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("home")}><span>진</span><div><strong>진료실</strong><small>CLINIC OPS</small></div></button>
        <nav>{visibleNav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "inventory" && <i>3</i>}</button>)}</nav>
        <div className="sidebar-help"><strong>도움이 필요하신가요?</strong><p>운영 매뉴얼과 문의 안내를 확인하세요.</p><button>도움말 보기</button></div>
        <div className="user-card"><span>김</span><div><strong>김다은</strong><small>{role === "staff" ? "직원" : "관리자"} · 진료팀</small></div><button>⋮</button></div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span>진</span><strong>진료실</strong></div>
          <div className="clinic"><span className="status-dot" /> 온담의원 강남점</div>
          <div className="top-actions">
            <label className="role-switch"><span>보기 모드</span><select value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="staff">직원 모드</option><option value="admin">관리자 모드</option></select></label>
            <button className="notification" aria-label="알림">♢<i /></button>
          </div>
        </header>
        <main className="content">
          {view === "inventory" ? <InventoryView role={role} /> : view === "home" ? <HomeView setView={setView} /> : <PlaceholderView title={navItems.find((item) => item.id === view)?.label ?? "업무"} />}
        </main>
      </div>
      <nav className="mobile-nav">{visibleNav.slice(0, 5).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
    </div>
  );
}
