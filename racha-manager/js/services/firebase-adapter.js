
const initializeApp = config => firebase.initializeApp(config);
const getFirestore = app => app.firestore();
const doc = (database,...parts) => database.doc(parts.join('/'));
const getDoc = async reference => {
  const snapshot=await reference.get();
  return {exists:()=>snapshot.exists,data:()=>snapshot.data()};
};
const setDoc = (reference,data,options) => reference.set(data,options);
const updateDoc = (reference,data) => reference.update(data);
const deleteField = () => firebase.firestore.FieldValue.delete();
const getAuth = app => app.auth();
const signInWithEmailAndPassword = (instance,email,password) => instance.signInWithEmailAndPassword(email,password);
const sendPasswordResetEmail = (instance,email) => instance.sendPasswordResetEmail(email);
const makeEmailCredential = (email,password) => firebase.auth.EmailAuthProvider.credential(email,password);
const reauthenticateWithCredential = (user,credential) => user.reauthenticateWithCredential(credential);
const updatePassword = (user,password) => user.updatePassword(password);
const signOut = instance => instance.signOut();
const onAuthStateChanged = (instance,callback) => instance.onAuthStateChanged(callback);
const getStorage = app => app.storage();
const storageRef = (instance,path) => instance.ref(path);
const uploadBytes = (reference,file,metadata) => reference.put(file,metadata);
const getDownloadURL = reference => reference.getDownloadURL();
const deleteObject = reference => reference.delete();

