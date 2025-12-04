// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
   apiKey: "AIzaSyAnYfTmNKw8SLhm5i96OO4-BXj2TTtCyXg",
  authDomain: "codesync-live-3a3e0.firebaseapp.com",
  databaseURL: "https://codesync-live-3a3e0-default-rtdb.firebaseio.com",
  projectId: "codesync-live-3a3e0",
  storageBucket: "codesync-live-3a3e0.firebasestorage.app",
  messagingSenderId: "249221069508",
  appId: "1:249221069508:web:b34aa839b2ae7edb35e791",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(app);
