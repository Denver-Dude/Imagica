import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const provider = new GoogleAuthProvider();

/* =====================
   SIGN IN (index.html)
===================== */
const loginBtn = document.getElementById("googleSignIn");

loginBtn?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "board.html";
  } catch (err) {
    console.error("Login error:", err);
  }
});

/* =====================
   AUTH GUARD (board.html)
===================== */
onAuthStateChanged(auth, (user) => {
  const isBoard = window.location.pathname.includes("board.html");

  if (isBoard && !user) {
    // Block access
    window.location.href = "index.html";
    return;
  }

  if (user) {
    console.log("User UID:", user.uid);
    // Use user.uid everywhere
  }
});

/* =====================
   LOGOUT (optional)
===================== */
const logoutBtn = document.getElementById("logout");

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
