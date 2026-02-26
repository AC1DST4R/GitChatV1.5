import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyAME65WaAba-_8WWm2mrHCEnR8feiyUiKs",
  authDomain: "gitchat-backend-v2.firebaseapp.com",
  projectId: "gitchat-backend-v2",
  storageBucket: "gitchat-backend-v2.firebasestorage.app",
  messagingSenderId: "1082807018532",
  appId: "1:1082807018532:web:cab8abe0d41097b33fe4b1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentServer = null;
let displayName = "";
let usernameColor = "#00d4ff";

/* AUTH BUTTONS */
loginBtn.onclick = () =>
  signInWithEmailAndPassword(auth, email.value, password.value);

registerBtn.onclick = () =>
  createUserWithEmailAndPassword(auth, email.value, password.value);

googleBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};

guestBtn.onclick = async () => {
  if (auth.currentUser) await signOut(auth);
  await signInAnonymously(auth);
};

logoutBtn.onclick = async () => {
  await signOut(auth);
};

/* AUTH STATE FIXED */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    authScreen.classList.remove("hidden");
    app.classList.add("hidden");
    return;
  }

  currentUser = user;

  displayName = user.isAnonymous
    ? "GUEST" + Math.floor(1000 + Math.random() * 9000)
    : user.email.split("@")[0];

  authScreen.classList.add("hidden");
  app.classList.remove("hidden");

  await loadServers();
});

/* SERVER CREATION SYSTEM */

createServerBtn.onclick = async () => {

  const serverName = prompt("Server Name:");
  if (!serverName) return;

  const isPublic = confirm("Make this server PUBLIC?\n\nPublic servers do not require passwords.");

  let password = null;

  if (!isPublic) {
    password = prompt("Set Server Password:");
    if (!password) return alert("Password required for private servers.");
  }

  const serverId = crypto.randomUUID(); // auto generated ID

  await setDoc(doc(db, "servers", serverId), {
    name: serverName,
    owner: currentUser.uid,
    public: isPublic,
    password: password || null,
    created: Date.now()
  });

  await addServerToUser(serverId);

  alert("Server created!");
};

async function addServerToUser(serverId) {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);

  let servers = [];
  if (snap.exists()) servers = snap.data().servers || [];

  servers.push(serverId);

  await setDoc(userRef, { servers }, { merge: true });

  loadServers();
}

/* LOAD SERVERS */

async function loadServers() {
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);

  serverList.innerHTML = "";

  if (!snap.exists()) return;

  const servers = snap.data().servers || [];

  for (const id of servers) {
    const serverSnap = await getDoc(doc(db, "servers", id));
    if (!serverSnap.exists()) continue;

    const btn = document.createElement("button");
    btn.textContent = serverSnap.data().name;

    btn.onclick = () => joinServer(id);

    serverList.appendChild(btn);
  }
}

/* JOIN SERVER */

async function joinServer(serverId) {
  const serverSnap = await getDoc(doc(db, "servers", serverId));
  if (!serverSnap.exists()) return;

  const server = serverSnap.data();

  if (!server.public) {
    const input = prompt("Enter server password:");
    if (input !== server.password) {
      alert("Wrong password!");
      return;
    }
  }

  currentServer = serverId;

  const messagesRef = collection(db, "servers", serverId, "messages");
  const q = query(messagesRef, orderBy("timestamp"));

  onSnapshot(q, (snapshot) => {
    messages.innerHTML = "";
    snapshot.forEach(doc => {
      const msg = doc.data();
      messages.innerHTML += `
        <div>
          <span style="color:${msg.color}">
          ${msg.username}
          </span>: ${msg.text}
        </div>`;
    });
  });
}

/* CHAT */

messageInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  if (!currentServer) return alert("Join a server first.");

  await addDoc(collection(db, "servers", currentServer, "messages"), {
    username: displayName,
    color: usernameColor,
    text: messageInput.value,
    timestamp: Date.now()
  });

  messageInput.value = "";
});
