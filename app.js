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
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* CONFIG */
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

document.addEventListener("DOMContentLoaded", () => {

  const $ = id => document.getElementById(id);

  const authScreen = $("authScreen");
  const appScreen = $("app");
  const settingsPage = $("settingsPage");
  const messagesDiv = $("messages");
  const serverList = $("serverList");
  const joinModal = $("joinModal");
  const passwordContainer = $("passwordContainer");

  let currentUser = null;
  let currentServer = null;
  let displayName = "";
  let nameColor = "#00d4ff";
  let unsubscribe = null;

  /* AUTH BUTTONS */
  $("loginBtn").onclick = () => signInWithEmailAndPassword(auth, $("email").value, $("password").value);
  $("registerBtn").onclick = () => createUserWithEmailAndPassword(auth, $("email").value, $("password").value);
  $("googleBtn").onclick = async () => await signInWithPopup(auth,new GoogleAuthProvider());
  $("guestBtn").onclick = async () => { if(auth.currentUser) await signOut(auth); await signInAnonymously(auth); };
  $("logoutBtn").onclick = async () => await signOut(auth);

  /* AUTH STATE */
  onAuthStateChanged(auth, async (user)=>{
    if(!user){
      authScreen.classList.remove("hidden");
      appScreen.classList.add("hidden");
      settingsPage.classList.add("hidden");
      return;
    }

    currentUser = user;
    displayName = user.isAnonymous ? "GUEST"+Math.floor(1000+Math.random()*9000) : user.email.split("@")[0];

    await loadUserSettings();
    await loadServers();

    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    settingsPage.classList.add("hidden");
  });

  /* SETTINGS MENU */
  $("settingsBtn").onclick = () => {
    appScreen.classList.add("hidden");
    settingsPage.classList.remove("hidden");
    $("displayNameInput").value = displayName;
    $("colorInput").value = nameColor;
  };
  $("backBtn").onclick = () => { settingsPage.classList.add("hidden"); appScreen.classList.remove("hidden"); };
  $("saveSettingsBtn").onclick = async () => {
    displayName = $("displayNameInput").value;
    nameColor = $("colorInput").value;
    await setDoc(doc(db,"users",currentUser.uid),{displayName,color:nameColor},{merge:true});
    alert("Saved!");
  };

  async function loadUserSettings(){
    const snap = await getDoc(doc(db,"users",currentUser.uid));
    if(snap.exists()){
      displayName = snap.data().displayName || displayName;
      nameColor = snap.data().color || nameColor;
    }
  }

  /* SERVER FUNCTIONS */
  $("createServerBtn").onclick = async () => {
    const name = prompt("Server Name:");
    if(!name) return;

    const isPublic = confirm("Make server public?\nOK=Public Cancel=Private");
    let password = null;
    if(!isPublic){
      password = prompt("Set password:");
      if(!password) return alert("Password required");
    }

    const id = crypto.randomUUID();
    await setDoc(doc(db,"servers",id),{name,owner:currentUser.uid,public:isPublic,password,created:Date.now()});
    await addServerToUser(id);
  };

  /* JOIN SERVER MODAL */
  $("joinServerBtn").onclick = () => {
    $("joinServerIdInput").value="";
    $("joinPasswordInput").value="";
    passwordContainer.classList.add("hidden");
    joinModal.classList.remove("hidden");
  };
  $("cancelJoinBtn").onclick = () => joinModal.classList.add("hidden");

  $("joinServerIdInput").addEventListener("blur", async ()=>{
    const id = $("joinServerIdInput").value.trim();
    if(!id) return;
    const snap = await getDoc(doc(db,"servers",id));
    if(!snap.exists()) return;
    if(!snap.data().public) passwordContainer.classList.remove("hidden");
    else passwordContainer.classList.add("hidden");
  });

  $("confirmJoinBtn").onclick = async ()=>{
    const id = $("joinServerIdInput").value.trim();
    if(!id) return alert("Enter server ID");
    const snap = await getDoc(doc(db,"servers",id));
    if(!snap.exists()) return alert("Server not found");
    const server = snap.data();
    if(!server.public && $("joinPasswordInput").value!==server.password) return alert("Incorrect password");
    await addServerToUser(id);
    joinModal.classList.add("hidden");
  };

  async function addServerToUser(id){
    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);
    let servers = snap.exists() ? snap.data().servers || [] : [];
    if(!servers.includes(id)) servers.push(id);
    await setDoc(userRef,{servers},{merge:true});
    loadServers();
  }

  async function loadServers(){
    serverList.innerHTML="";
    const snap = await getDoc(doc(db,"users",currentUser.uid));
    if(!snap.exists()) return;
    const servers = snap.data().servers || [];
    for(const id of servers){
      const serverSnap = await getDoc(doc(db,"servers",id));
      if(!serverSnap.exists()) continue;
      const btn = document.createElement("button");
      btn.textContent = serverSnap.data().name;
      btn.onclick = ()=> joinServer(id);
      serverList.appendChild(btn);
    }
  }

  async function joinServer(id){
    currentServer = id;
    const serverSnap = await getDoc(doc(db,"servers",id));
    $("currentServerName").textContent = serverSnap.data().name;
    if(unsubscribe) unsubscribe();

    const q = query(collection(db,"servers",id,"messages"),orderBy("timestamp"));
    unsubscribe = onSnapshot(q,(snapshot)=>{
      messagesDiv.innerHTML="";
      snapshot.forEach(docSnap=>{
        const msg = docSnap.data();
        const time = new Date(msg.timestamp).toLocaleTimeString();
        messagesDiv.innerHTML+=`
          <div>
            <span style="color:${msg.color}">${msg.username}</span>
            <span class="timestamp">${time}</span>
            : ${msg.text}
          </div>`;
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
  }

  /* CHAT */
  $("messageInput").addEventListener("keydown", async e=>{
    if(e.key!=="Enter") return;
    if(!currentServer) return alert("Join a server first.");
    await addDoc(collection(db,"servers",currentServer,"messages"),{
      username:displayName,
      color:nameColor,
      text:e.target.value,
      timestamp:Date.now()
    });
    e.target.value="";
  });

});
