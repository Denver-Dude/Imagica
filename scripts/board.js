console.log("Imagica board.js running ✨");

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

  const board = document.getElementById("board");
  const addTextBtn = document.getElementById("addTextBtn");
  const addImgBtn = document.getElementById("addImgBtn");
  const photoInput = document.getElementById("photoInput");

  if (!board) {
    console.error("❌ board element missing in HTML");
    return;
  }

  let notes = [];
  let currentUser = null;

  /* ---------------- LOCAL STORAGE ---------------- */

  function saveToLocal() {
    localStorage.setItem("imagica-notes", JSON.stringify(notes));
  }

  function loadFromLocal() {
    try {
      return JSON.parse(localStorage.getItem("imagica-notes")) || [];
    } catch {
      return [];
    }
  }

  /* ---------------- FIREBASE LOAD / SAVE ---------------- */

  async function loadFromCloud(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : { notes: [] };
  }

  async function saveToCloud(uid) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { notes, updatedAt: Date.now() }, { merge: true });
  }

  async function hydrate(user) {

    let state = null;

    if (user) {
      try {
        state = await loadFromCloud(user.uid);
      } catch (e) {
        console.warn("cloud load failed, using local", e);
      }
    }

    if (!state) state = { notes: loadFromLocal() };

    notes = state.notes || [];

    render();
  }

  /* ---------------- SAVE DEBOUNCE ---------------- */

  let saveTimer = null;

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveToLocal();
      if (currentUser) saveToCloud(currentUser.uid);
    }, 400);
  }

  /* ---------------- DRAGGING ---------------- */

  let drag = null;

  function startDrag(e) {

    if (e.target.isContentEditable) return;

    const id = e.currentTarget.dataset.id;
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

  // IMPORTANT: do NOT re-render here
  function onDrag(e) {
    if (!drag) return;

    const note = notes.find(n => n.id === drag.id);
    if (!note) return;

    note.x = e.clientX - drag.dx;
    note.y = e.clientY - drag.dy;

    const el = document.querySelector(`[data-id="${note.id}"]`);
    if (el) {
      el.style.left = `${note.x}px`;
      el.style.top = `${note.y}px`;
    }
  }

  function endDrag() {
    drag = null;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", endDrag);
    scheduleSave();
  }

  /* ---------------- CREATE NOTES ---------------- */

  function addText() {
    notes.push({
      id: crypto.randomUUID(),
      type: "text",
      content: "Write here...",
      x: 120,
      y: 120,
      rotation: (Math.random() * 6) - 3
    });

    render();
    scheduleSave();
  }

  function resizeImage(base64, max = 320, cb) {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(max / img.width, max / img.height, 1);

      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      cb(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = base64;
  }

  function addImage(base64) {

    resizeImage(base64, 300, resized => {

      notes.push({
        id: crypto.randomUUID(),
        type: "image",
        url: resized,
        x: 140,
        y: 140,
        rotation: (Math.random() * 6) - 3
      });

      render();
      scheduleSave();
    });
  }

  /* ---------------- RENDER ---------------- */

  function render() {

    board.innerHTML = "";

    notes.forEach(note => {

      const el = document.createElement("div");
      el.className = "note";
      el.dataset.id = note.id;

      el.style.left = `${note.x}px`;
      el.style.top = `${note.y}px`;
      el.style.transform = `rotate(${note.rotation}deg)`;

      // hold to delete
      // hold to delete
  // right-click to delete note
el.addEventListener("contextmenu", (e) => {
  e.preventDefault(); // stop browser menu

  const really = confirm("Delete this note?");
  if (!really) return;

  notes = notes.filter(n => n.id !== note.id);

  render();
  scheduleSave();
});



      el.addEventListener("mousedown", startDrag);

      if (note.type === "text") {

        const txt = document.createElement("div");
        txt.className = "note-text";
        txt.contentEditable = true;
        txt.innerText = note.content;

        txt.addEventListener("mousedown", e => e.stopPropagation());

        txt.addEventListener("input", e => {
          note.content = e.target.innerText;
          scheduleSave();
        });

        el.appendChild(txt);
      }

      if (note.type === "image") {
        const img = document.createElement("img");
        img.src = note.url;
        img.className = "note-image";
        img.draggable = false;
        el.appendChild(img);
      }

      board.appendChild(el);
    });
  }

  /* ---------------- BUTTONS ---------------- */

  addTextBtn?.addEventListener("click", addText);

  addImgBtn?.addEventListener("click", () => photoInput.click());

  photoInput?.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    // 5MB guard
    if (file.size > 5 * 1024 * 1024) {
      alert("Please upload images under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => addImage(reader.result);
    reader.readAsDataURL(file);

    e.target.value = "";
  });

  /* ---------------- AUTH ---------------- */

  onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (!user) {
      notes = [];
      render();
      return;
    }

    await hydrate(user);
  });

});
