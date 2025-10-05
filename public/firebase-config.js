// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCzS6245V48Mb-q91qpjqK2l8o87MJ9Hho",
  authDomain: "mobitech-c93c0.firebaseapp.com",
  projectId: "mobitech-c93c0",
  storageBucket: "mobitech-c93c0.appspot.com",
  messagingSenderId: "284819435696",
  appId: "1:284819435696:web:933fae6a22a0b05ecdcb75",
  measurementId: "G-M1KEW3J26N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export the database instance
const db = firebase.firestore();
