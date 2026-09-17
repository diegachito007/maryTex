import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // ✅ AGREGAR setDoc
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [userData, setUserData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    return localStorage.getItem('selectedCompanyId') || null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const docSnap = await getDoc(doc(db, 'users', user.uid));
          
          if (docSnap.exists()) {
            // ✅ Usuario ya existe en Firestore
            setUserData({ uid: user.uid, ...docSnap.data() });
          } else {
            // ✅ NUEVO: Crear usuario automáticamente con status "pending"
            const newUserData = {
              uid: user.uid,
              email: user.email,
              name: user.displayName || user.email.split('@')[0],
              photoURL: user.photoURL || null,
              role: 'operario', // ✅ Rol por defecto
              status: 'pending', // ✅ Pendiente de aprobación
              createdAt: new Date()
            };
            
            await setDoc(doc(db, 'users', user.uid), newUserData);
            setUserData(newUserData);
            console.log('✅ Usuario nuevo creado en Firestore:', newUserData);
          }
        } catch (error) {
          console.error('Error cargando usuario:', error);
        }
      } else {
        setUserData(null);
        setSelectedCompanyId(null);
        localStorage.removeItem('selectedCompanyId');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      console.error('Error en login con Google:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setSelectedCompanyId(null);
      localStorage.removeItem('selectedCompanyId');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const selectCompany = (companyId) => {
    setSelectedCompanyId(companyId);
    localStorage.setItem('selectedCompanyId', companyId);
  };

  const clearCompany = () => {
    setSelectedCompanyId(null);
    localStorage.removeItem('selectedCompanyId');
  };

  const value = {
    user,
    userData,
    loading,
    loginWithGoogle,
    logout,
    selectedCompanyId,
    selectCompany,
    clearCompany
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}