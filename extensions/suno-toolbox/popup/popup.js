const $ = (s) => document.querySelector(s);
const store = {
  get: (k, d) => chrome.storage.local.get({ [k]: d }).then((r) => r[k]),
  set: (k, v) => chrome.storage.local.set({ [k]: v }),
};

// ---------- 탭 전환 ----------
document.querySelectorAll(".tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $("#" + b.dataset.tab).classList.add("active");
    store.set("lastTab", b.dataset.tab);
  });
});

// ---------- 메모 ----------
const memo = $("#memoText");
let memoTimer;
async function initMemo() {
  memo.value = await store.get("memo", "");
  memo.addEventListener("input", () => {
    clearTimeout(memoTimer);
    $("#memoSaved").textContent = "입력 중…";
    memoTimer = setTimeout(async () => {
      await store.set("memo", memo.value);
      $("#memoSaved").textContent = "자동 저장됨 ✓";
    }, 400);
  });
  $("#memoClear").addEventListener("click", async () => {
    if (!memo.value || confirm("메모를 모두 지울까요?")) {
      memo.value = "";
      await store.set("memo", "");
      $("#memoSaved").textContent = "비웠어요";
    }
  });
}

// ---------- 할일 ----------
async function getTodos() { return store.get("todos", []); }
async function setTodos(v) { return store.set("todos", v); }

async function renderTodos() {
  const todos = await getTodos();
  const ul = $("#todoList");
  ul.innerHTML = "";
  $("#todoEmpty").style.display = todos.length ? "none" : "block";
  todos.forEach((t, i) => {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = t.done;
    cb.addEventListener("change", async () => {
      const arr = await getTodos(); arr[i].done = cb.checked; await setTodos(arr); renderTodos();
    });
    const span = document.createElement("span");
    span.className = "txt" + (t.done ? " done" : "");
    span.textContent = t.text;
    const del = document.createElement("button");
    del.textContent = "✕"; del.title = "삭제";
    del.addEventListener("click", async () => {
      const arr = await getTodos(); arr.splice(i, 1); await setTodos(arr); renderTodos();
    });
    li.append(cb, span, del);
    ul.appendChild(li);
  });
}
function initTodo() {
  $("#todoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#todoInput").value.trim();
    if (!v) return;
    const arr = await getTodos();
    arr.unshift({ text: v, done: false });
    await setTodos(arr);
    $("#todoInput").value = "";
    renderTodos();
  });
  renderTodos();
}

// ---------- 저장한 페이지 ----------
async function getPages() { return store.get("pages", []); }
async function setPages(v) { return store.set("pages", v); }

async function renderPages() {
  const pages = await getPages();
  const ul = $("#pageList");
  ul.innerHTML = "";
  $("#pageEmpty").style.display = pages.length ? "none" : "block";
  pages.forEach((p, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "txt"; a.href = p.url; a.target = "_blank"; a.rel = "noreferrer";
    a.textContent = p.title || p.url;
    let host = ""; try { host = new URL(p.url).hostname; } catch {}
    const sub = document.createElement("span");
    sub.className = "sub"; sub.textContent = host;
    const wrap = document.createElement("div");
    wrap.style.flex = "1"; wrap.style.overflow = "hidden";
    wrap.append(a, sub);
    const del = document.createElement("button");
    del.textContent = "✕"; del.title = "삭제";
    del.addEventListener("click", async () => {
      const arr = await getPages(); arr.splice(i, 1); await setPages(arr); renderPages();
    });
    li.append(wrap, del);
    ul.appendChild(li);
  });
}
function initPages() {
  $("#savePage").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || /^chrome/.test(tab.url)) {
      $("#savePage").textContent = "이 페이지는 저장할 수 없어요";
      setTimeout(() => ($("#savePage").textContent = "＋ 지금 페이지 저장"), 1500);
      return;
    }
    const arr = await getPages();
    if (!arr.some((p) => p.url === tab.url)) {
      arr.unshift({ title: tab.title || tab.url, url: tab.url, ts: Date.now() });
      await setPages(arr);
    }
    $("#savePage").textContent = "저장됨 ✓";
    setTimeout(() => ($("#savePage").textContent = "＋ 지금 페이지 저장"), 1200);
    renderPages();
  });
  renderPages();
}

// ---------- 수노 저장 폴더 설정 ----------
async function initSunoFolder() {
  const input = $("#sunoFolder");
  input.value = await store.get("sunoFolder", "Suno");
  const save = async () => {
    const v = input.value.trim();
    await store.set("sunoFolder", v);
    const hint = $("#folderHint");
    hint.innerHTML = v
      ? `저장됨 ✓ → 다운로드\\<b>${v.replace(/</g, "&lt;")}</b> 폴더`
      : "저장됨 ✓ → 다운로드 폴더에 바로 저장";
    setTimeout(() => {
      hint.innerHTML =
        "예) <b>Suno</b> → 다운로드\\Suno 폴더에 저장. 비워두면 다운로드 폴더에 바로 저장돼요.";
    }, 2200);
  };
  $("#folderForm").addEventListener("submit", (e) => { e.preventDefault(); save(); });
}

// ---------- 초기화 ----------
(async () => {
  await initMemo();
  initTodo();
  initPages();
  initSunoFolder();
  const last = await store.get("lastTab", "memo");
  const btn = document.querySelector(`.tabs button[data-tab="${last}"]`);
  if (btn) btn.click();
})();
