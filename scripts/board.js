console.log("Imagica board.js loaded");

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- DOM ---------- */

  const board = document.getElementById("board");
  const addTextBtn = document.getElementById("addTextBtn");
  const addImgBtn = document.getElementById("addImgBtn");
  const photoInput = document.getElementById("photoInput");

  if (!board) {
    console.error("❌ #board element is missing in HTML");
  }

  /* ---------- STATE ---------- */

  let notes = [];
  let currentUser = null;
  let hydrated = false;

  /* ---------- HISTORY ---------- */

  let history = [];
  let redoStack = [];
  const MAX_HISTORY = 50;

  function pushHistory() {
    history.push(JSON.stringify(notes));
    if (history.length > MAX_HISTORY) history.shift();
    redoStack = [];
  }

  /* ---------- LOCAL STORAGE ---------- */

  const LS_KEY = "imagica-board-state";

  function saveToLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify({ notes }));
  }

  function loadFromLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /* ---------- FIRESTORE ---------- */

  async function loadFromCloud(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  }

  async function saveToCloud(uid) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { notes, updatedAt: Date.now() }, { merge: true });
  }

  /* ---------- SAVE ---------- */

  let saveTimer = null;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveToLocal();
      if (currentUser) await saveToCloud(currentUser.uid);
    }, 500);
  }

  /* ---------- NOTE HELPERS ---------- */

  function createTextNote() {
    pushHistory();

    notes.push({
      id: crypto.randomUUID(),
      type: "text",
      x: 120,
      y: 120,
      content: "New note...",
      rotation: (Math.random() * 6) - 3
    });

    render();
    scheduleSave();
  }

  function createImageNote(url) {
    pushHistory();

    notes.push({
      id: crypto.randomUUID(),
      type: "image",
      x: 140,
      y: 140,
      url,
      rotation: (Math.random() * 6) - 3
    });

    render();
    scheduleSave();
  }

  function deleteNote(id) {
    pushHistory();
    notes = notes.filter(n => n.id !== id);
    render();
    scheduleSave();
  }

  /* ---------- DRAGGING ---------- */

  let drag = null;

  function startDrag(e) {
    const el = e.currentTarget;
    const id = el.dataset.id;
    const note = notes.find(n => n.id === id);
    if (!note) return;

    drag = {
      id,
      dx: e.clientX - note.x,
      dy: e.clientY - note.y
    };

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
  }

  function onDrag(e) {
    if (!drag) return;

    const note = notes.find(n => n.id === drag.id);
    if (!note) return;

    note.x = e.clientX - drag.dx;
    note.y = e.clientY - drag.dy;

    render();
  }

  function endDrag() {
    drag = null;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", endDrag);
    scheduleSave();
  }

  /* ---------- RENDER ---------- */

  function clearBoard() {
    if (!board) return;
    board.innerHTML = "";
  }

  function render() {
    if (!board) return;

    clearBoard();

    notes.forEach(note => {
      const el = document.createElement("div");
      el.className = "note";
      el.dataset.id = note.id;

      el.style.left = note.x + "px";
      el.style.top = note.y + "px";
      el.style.transform = `rotate(${note.rotation}deg)`;

      // delete button
      const del = document.createElement("button");
      del.className = "delete";
      del.textContent = "×";
      del.onclick = () => deleteNote(note.id);
      el.appendChild(del);

      if (note.type === "text") {
        const txt = document.createElement("div");
        txt.className = "note-text";
        txt.contentEditable = true;
        txt.innerText = note.content;

        txt.addEventListener("input", e => {
          note.content = e.target.innerText;
          scheduleSave();
        });

        el.appendChild(txt);

      } else if (note.type === "image") {
        const img = document.createElement("img");
        img.src = note.url;
        img.draggable = false;
        el.appendChild(img);
      }

      el.addEventListener("mousedown", startDrag);

      board.appendChild(el);
    });
  }

  /* ---------- HYDRATE ---------- */

  async function hydrate(user) {
    if (hydrated) return;
    hydrated = true;

    let state = null;

    if (user) {
      try {
        state = await loadFromCloud(user.uid);
      } catch {}
    }

    if (!state) state = loadFromLocal();

    notes = Array.isArray(state?.notes) ? state.notes : [];
    render();
  }

  /* ---------- AUTH ---------- */

  onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (!user) {
      notes = [];
      render();
      return;
    }

    await hydrate(user);
  });

  /* ---------- BUTTONS ---------- */

  addTextBtn?.addEventListener("click", createTextNote);

  addImgBtn?.addEventListener("click", () => {
    photoInput?.click();
  });

  photoInput?.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => createImageNote(reader.result);
    reader.readAsDataURL(file);

    e.target.value = "";
  });

});
