// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCd0SIKxLcg16RIrrmij5-t-6lH8Jk1PBQ",
  authDomain: "imagica-bydude.firebaseapp.com",
  projectId: "imagica-bydude",

  // correct bucket domain
  storageBucket: "imagica-bydude.appspot.com",

  messagingSenderId: "396448441430",
  appId: "1:396448441430:web:15bb5aabe0da244dcc47f7",
  measurementId: "G-7NV7C628CT"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Firebase initialized ✓");
