// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Konfigurasi Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA7yUt5zPjxRcjKL-gO-TR6DmJxXxJ1isI",
    authDomain: "warungdsps.firebaseapp.com",
    databaseURL: "https://warungdsps-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "warungdsps",
    storageBucket: "warungdsps.firebasestorage.app",
    messagingSenderId: "171016403842",
    appId: "1:171016403842:web:623b64145f03f64b386d9b",
    measurementId: "G-9W1DRL3E5H"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Ekspor objek db agar bisa digunakan di file lain
export { db };
