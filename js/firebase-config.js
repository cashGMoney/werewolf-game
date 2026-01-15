// Load Firebase using the compat libraries (matches the rest of your code)
const firebaseConfig = {
  apiKey: "AIzaSyCUeKCe4cKf6GOU6yfdSxtOuDHvzcHcvTk",
  authDomain: "werewolf-game-328fc.firebaseapp.com",
  databaseURL: "https://werewolf-game-328fc-default-rtdb.firebaseio.com",
  projectId: "werewolf-game-328fc",
  storageBucket: "werewolf-game-328fc.firebasestorage.app",
  messagingSenderId: "91488102012",
  appId: "1:91488102012:web:156764721d0bc442eecbf9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
