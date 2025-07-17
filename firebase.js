// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: "AIzaSyBRB7vQ4els4zLJ_AJ6owm0GKIhItJWFH8",
	authDomain: "primal-printing.firebaseapp.com",
	projectId: "primal-printing",
	storageBucket: "primal-printing.appspot.com",
	messagingSenderId: "730452399600",
	appId: "1:730452399600:web:2b45a8af7bc16039ce3935",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
export default storage;
