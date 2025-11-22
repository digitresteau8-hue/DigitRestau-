
import React, { useState, useEffect } from 'react';

// Data and Types
import { Dish, User, CartItem, Order, Box, Settings, initialSettings, Review } from './components/data';
import { getDishes, saveDishes, getOrders, saveOrders, createOrder, getBoxes, saveBoxes, getSettings, saveSettings, authSignIn, authSignOut, authGetUser, authUpdateUser } from './components/db';
import { supabase } from './components/supabaseClient';

// Client Pages
import ClientHomePage from './components/ClientHomePage';
import ClientMenuPage from './components/ClientMenuPage';
import ClientCartPage from './components/ClientCartPage';
import ClientCateringPage from './components/ClientCateringPage';
import ClientBoxesPage from './components/ClientBoxesPage';
import ClientOrdersPage from './components/ClientOrdersPage';
import ClientAccountPage from './components/ClientAccountPage';
import ClientContactPage from './components/ClientContactPage';

// Admin Pages
import AdminDashboardPage from './components/AdminDashboardPage';
import AdminDishesPage from './components/AdminDishesPage';
import AdminOrdersPage from './components/AdminOrdersPage';
import AdminCateringPage from './components/AdminCateringPage';
import AdminBoxesPage from './components/AdminBoxesPage';
import AdminAccountPage from './components/AdminAccountPage';
import AdminContactPage from './components/AdminContactPage';
import AdminSettingsPage from './components/AdminSettingsPage';
import AdminMarketingPage from './components/AdminMarketingPage';
import AdminAiAssistant from './components/AdminAiAssistant';

// Layouts & Components
import ClientBottomNav from './components/ClientBottomNav';
import AdminLayout from './components/AdminLayout';
import ClientHeader from './components/Header';
import Notification from './components/Notification';
import AnimatedBackground from './components/AnimatedBackground';


export type Page = 
  | 'home' | 'menu' | 'cart' | 'traiteur' | 'boxs' | 'commande' | 'compte' | 'contact'
  | 'admin-dashboard' | 'admin-plats' | 'admin-panier' | 'admin-traiteur' | 'admin-boxs' 
  | 'admin-commandes' | 'admin-compte' | 'admin-contact' | 'admin-parametres'
  | 'admin-marketing' | 'admin-ai';

export type NotificationType = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

const App: React.FC = () => {
  const [page, setPage] = useState<Page>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  // --- INITIALISATION & TEMPS RÉEL ---
  useEffect(() => {
    async function loadData() {
        try {
            const [dbDishes, dbOrders, dbBoxes, dbSettings] = await Promise.all([
                getDishes(),
                getOrders(),
                getBoxes(),
                getSettings()
            ]);
            setDishes(dbDishes.sort((a, b) => (a.id > b.id ? -1 : 1)));
            setOrders(dbOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setBoxes(dbBoxes);
            setSettings(dbSettings);
            
            const user = await authGetUser();
            // Force check localStorage for Admin Persistence
            const localAdmin = localStorage.getItem('digitrestau_is_admin') === 'true';

            if (user) {
                // Utilisateur connecté via Supabase Auth (Vraie session)
                const isSupabaseAdmin = user.user_metadata.isAdmin === true;
                
                setCurrentUser({
                    id: user.id,
                    name: user.user_metadata.name || user.email?.split('@')[0] || 'Utilisateur',
                    email: user.email,
                    phone: user.user_metadata.phone || '',
                    points: 120, // Mock points pour l'exemple
                    avatarUrl: user.user_metadata.avatarUrl || null,
                    isAdmin: isSupabaseAdmin
                });
                
                if (user.email === 'admin@digitrestau.com' || localAdmin || isSupabaseAdmin) {
                    setIsAdmin(true);
                }
            } else if (localAdmin) {
                // Admin Local (Code Secret) - Pas de session Supabase mais Cookie Local
                setIsAdmin(true);
                const localAvatar = localStorage.getItem('digitrestau_local_avatar');
                setCurrentUser({
                    id: 'admin-local',
                    name: 'Lawson Laure', // Nom par défaut demandé
                    phone: '00000000',
                    email: 'admin@digitrestau.com',
                    points: 9999,
                    avatarUrl: localAvatar || null, // Charge l'avatar local
                    isAdmin: true
                });
            }

        } catch (e) {
            console.error("Erreur d'initialisation", e);
            showNotification("Impossible de charger les données.", 'error');
        } finally {
            setIsLoading(false);
        }
    }
    loadData();

    if (supabase) {
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
             if (event === 'SIGNED_IN' && session?.user) {
                 const user = session.user;
                 const isSupabaseAdmin = user.user_metadata.isAdmin === true;
                 const localAdmin = localStorage.getItem('digitrestau_is_admin') === 'true';

                 setCurrentUser({
                    id: user.id,
                    name: user.user_metadata.name || 'Utilisateur',
                    email: user.email,
                    phone: user.user_metadata.phone || '',
                    points: 120,
                    avatarUrl: user.user_metadata.avatarUrl || null,
                    isAdmin: isSupabaseAdmin
                 });
                 
                 if (user.email === 'admin@digitrestau.com' || localAdmin || isSupabaseAdmin) {
                     setIsAdmin(true);
                 }

             } else if (event === 'SIGNED_OUT') {
                 setCurrentUser(null);
                 setIsAdmin(false);
                 // On ne nettoie pas localAdmin ici pour éviter les déconnexions intempestives si refresh
                 setPage('home');
             } else if (event === 'USER_UPDATED' && session?.user) {
                 // Refresh user data on update
                 const user = session.user;
                 const isSupabaseAdmin = user.user_metadata.isAdmin === true;
                 
                 setCurrentUser({
                    id: user.id,
                    name: user.user_metadata.name || 'Utilisateur',
                    email: user.email,
                    phone: user.user_metadata.phone || '',
                    points: 120,
                    avatarUrl: user.user_metadata.avatarUrl || null,
                    isAdmin: isSupabaseAdmin
                 });
                 
                 if (isSupabaseAdmin) setIsAdmin(true);
             }
        });

        const ordersSubscription = supabase
            .channel('realtime-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
                const freshOrders = await getOrders();
                setOrders(freshOrders);
                
                // Notification Admin pour nouvelle commande
                if (payload.eventType === 'INSERT') {
                    if (isAdmin) {
                        try {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                            audio.play().catch(e => {});
                        } catch (e) {}
                        showNotification('🔔 Nouvelle commande reçue !', 'success');
                    }
                } 
                // Notification Client pour mise à jour statut
                else if (payload.eventType === 'UPDATE') {
                    // Son de notification générique pour mise à jour
                    try {
                       const chime = new Audio('https://assets.mixkit.co/active_storage/sfx/2864/2864-preview.mp3');
                       chime.play().catch(e => {});
                    } catch(e) {}
                }
            })
            .subscribe();

        return () => {
            authListener.subscription.unsubscribe();
            supabase.removeChannel(ordersSubscription);
        };
    }
  }, []);

  // --- Persistance Panier ---
  useEffect(() => {
    try {
        const savedCart = localStorage.getItem('digitrestau-cart');
        if (savedCart) setCart(JSON.parse(savedCart));
    } catch (e) {
        console.error("Failed to load cart", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('digitrestau-cart', JSON.stringify(cart));
  }, [cart]);
  

  // --- Système de Notification ---
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newNotification = { id: Date.now(), message, type };
    setNotifications(prev => [...prev, newNotification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 4000);
  };

  // --- Gestion Auth ---
  const handleLogin = async (identifier: string, password: string) => {
      try {
          if (!supabase) {
               if (identifier === 'admin@digitrestau.com' && password === 'admin123') {
                  setIsAdmin(true);
                  localStorage.setItem('digitrestau_is_admin', 'true');
                  setPage('admin-dashboard');
                  showNotification('Mode Admin (Local) activé.', 'success');
                  setCurrentUser({ id: 'admin-local', name: 'Lawson Laure', phone: '0000', email: 'admin@local.com', points: 0, isAdmin: true });
                } else {
                    const dummyUser: User = { id: `u_${identifier}`, name: 'Client Local', phone: identifier, points: 50 };
                    setCurrentUser(dummyUser);
                    setPage('home');
                    showNotification(`Bienvenue !`, 'success');
                }
                return;
          }

          const { user } = await authSignIn(identifier, password);
          if (user) {
              const isSupabaseAdmin = user.user_metadata.isAdmin === true;
              const localAdmin = localStorage.getItem('digitrestau_is_admin') === 'true';
              
              setCurrentUser({
                  id: user.id,
                  name: user.user_metadata.name || 'Utilisateur',
                  email: user.email,
                  phone: user.user_metadata.phone,
                  points: 150,
                  avatarUrl: user.user_metadata.avatarUrl || null,
                  isAdmin: isSupabaseAdmin
              });
              
              if (user.email === 'admin@digitrestau.com' || localAdmin || isSupabaseAdmin) {
                  setIsAdmin(true);
                  setPage('admin-dashboard');
              } else {
                  setPage('home');
              }
              showNotification('Connexion réussie.', 'success');
          }
      } catch (error: any) {
          showNotification(error.message || 'Identifiants incorrects.', 'error');
      }
  };
  
  const handleLogout = async () => {
      await authSignOut();
      setIsAdmin(false);
      localStorage.removeItem('digitrestau_is_admin');
      setCurrentUser(null);
      setPage('home');
      showNotification('Vous avez été déconnecté.', 'info');
  };
  
  const handleBecomeAdmin = async () => {
      setIsAdmin(true);
      localStorage.setItem('digitrestau_is_admin', 'true');
      setPage('admin-dashboard');
      showNotification("Accès Administrateur accordé !", "success");
      
      // Sauvegarder le statut Admin dans Supabase pour que ce soit permanent
      if (currentUser && currentUser.id !== 'admin-local') {
          try {
              // Force refresh of current user logic before update if possible
              await authUpdateUser({ isAdmin: true });
              
              // Force session refresh by re-fetching user
              if (supabase) {
                  const { data } = await supabase.auth.refreshSession();
                  if (data.user) {
                      console.log("Session refreshed with admin status");
                  }
              }
              
              showNotification("Votre compte est maintenant Administrateur permanent sur le Cloud.", "success");
          } catch (e) {
              console.error("Impossible de sauvegarder le statut admin sur le cloud", e);
          }
      }
      
      const localAvatar = localStorage.getItem('digitrestau_local_avatar');
      setCurrentUser(prev => {
          if (!prev) {
              return {
                  id: 'admin-local',
                  name: 'Lawson Laure',
                  phone: '00000000',
                  email: 'admin@digitrestau.com',
                  points: 0,
                  avatarUrl: localAvatar || null,
                  isAdmin: true
              };
          }
          return {
              ...prev,
              name: prev.name || 'Lawson Laure',
              avatarUrl: prev.avatarUrl || localAvatar || null,
              isAdmin: true
          };
      });
  };

  // --- Gestion Panier ---
  const addToCart = (dish: Dish, quantity: number = 1, instructions: string = '') => {
    setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === dish.id);
        if (existingItem) {
            return prevCart.map(item => item.id === dish.id ? { 
                ...item, 
                quantity: item.quantity + quantity,
                specialInstructions: instructions || item.specialInstructions // Mise à jour des instructions si fournies
            } : item);
        }
        return [...prevCart, { ...dish, quantity, specialInstructions: instructions }];
    });
    showNotification(`${quantity}x ${dish.name} ajouté au panier !`, 'success');
  };

  const updateCartQuantity = (dishId: string, quantity: number) => {
    setCart(prevCart => {
        if (quantity <= 0) {
            return prevCart.filter(item => item.id !== dishId);
        }
        return prevCart.map(item => item.id === dishId ? { ...item, quantity } : item);
    });
  };
  
  const clearCart = () => setCart([]);
  
  // --- Mises à jour Données ---
  const handleUpdateDishes = async (updatedDishes: Dish[], successMessage: string) => {
      const sortedDishes = [...updatedDishes].sort((a, b) => (a.id > b.id ? -1 : 1));
      setDishes(sortedDishes);
      try {
          await saveDishes(sortedDishes); 
          showNotification(successMessage, 'success');
      } catch (err) {
          showNotification("Erreur lors de la sauvegarde des plats.", 'error');
      }
  };

  const addReview = async (dishId: string, review: Omit<Review, 'id'>) => {
      const newReview = { ...review, id: `r${Date.now()}` };
      const dishToUpdate = dishes.find(d => d.id === dishId);
      if (dishToUpdate) {
          const updatedDish = { 
              ...dishToUpdate, 
              reviews: [newReview, ...(dishToUpdate.reviews || [])] 
          };
          setDishes(dishes.map(d => d.id === dishId ? updatedDish : d));
          try {
            await saveDishes([updatedDish]);
            showNotification('Votre avis a été publié !', 'success');
          } catch (e) {
              showNotification("Erreur lors de l'envoi de l'avis.", 'error');
          }
      }
  };

  const editReview = async (dishId: string, updatedReview: Review) => {
       const dishToUpdate = dishes.find(d => d.id === dishId);
       if (dishToUpdate) {
           const updatedReviews = (dishToUpdate.reviews || []).map(review => 
               review.id === updatedReview.id ? updatedReview : review
           );
           const updatedDish = { ...dishToUpdate, reviews: updatedReviews };
           setDishes(dishes.map(d => d.id === dishId ? updatedDish : d));
           await saveDishes([updatedDish]);
           showNotification('Avis mis à jour.', 'success');
       }
  };

  const deleteReview = async (dishId: string, reviewId: string) => {
      const dishToUpdate = dishes.find(d => d.id === dishId);
      if (dishToUpdate) {
          const updatedReviews = (dishToUpdate.reviews || []).filter(review => review.id !== reviewId);
          const updatedDish = { ...dishToUpdate, reviews: updatedReviews };
          setDishes(dishes.map(d => d.id === dishId ? updatedDish : d));
          await saveDishes([updatedDish]);
          showNotification('Avis supprimé.', 'success');
      }
  };
  
  const handleUpdateOrders = async (updatedOrders: Order[]) => {
      const sortedOrders = updatedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(sortedOrders);
      try {
          await saveOrders(sortedOrders);
      } catch (err) {
          showNotification("Erreur sauvegarde commandes.", 'error');
      }
  };

  const addOrder = async (newOrderData: Omit<Order, 'id' | 'date' | 'status'>) => {
    const newOrder: Order = {
        ...newOrderData,
        id: `DR-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        status: 'Confirmée',
    };
    setOrders([newOrder, ...orders]);
    try {
        await createOrder(newOrder);
    } catch (e) {
        console.error(e);
        showNotification("Erreur lors de l'envoi de la commande au serveur.", 'error');
    }
  };
  
  const handleUpdateBoxes = async (updatedBoxes: Box[]) => {
      setBoxes(updatedBoxes);
      await saveBoxes(updatedBoxes);
      showNotification('Boxs mises à jour.', 'success');
  }

  const handleUpdateSettings = async (updatedSettings: Settings) => {
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
      showNotification('Paramètres sauvegardés.', 'success');
  }

  if (isLoading) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white">
              <img src="https://i.ibb.co/WWHPStfL/1759863774896.png" alt="Loading" className="w-40 h-auto mb-6 animate-pulse drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]" />
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-6 text-cyan-400 font-serif tracking-widest text-lg animate-pulse">CHARGEMENT DU SYSTEME...</p>
          </div>
      );
  }

  const renderClientPage = () => {
    switch (page) {
      case 'home': return <ClientHomePage setPage={setPage} />;
      case 'menu': return <ClientMenuPage dishes={dishes} addToCart={addToCart} currentUser={currentUser} addReview={addReview} editReview={editReview} deleteReview={deleteReview} />;
      case 'cart': return <ClientCartPage cart={cart} updateCartQuantity={updateCartQuantity} clearCart={clearCart} setPage={setPage} showNotification={showNotification} addOrder={addOrder} currentUser={currentUser} settings={settings} />;
      case 'traiteur': return <ClientCateringPage />;
      case 'boxs': return <ClientBoxesPage boxes={boxes}/>;
      case 'commande': return <ClientOrdersPage currentUser={currentUser} orders={orders} settings={settings} />;
      case 'compte': return <ClientAccountPage onLogin={handleLogin} onLogout={handleLogout} currentUser={currentUser} onBecomeAdmin={handleBecomeAdmin} />;
      case 'contact': return <ClientContactPage />;
      default: return <ClientHomePage setPage={setPage} />;
    }
  };

  const renderAdminPage = () => {
     switch (page) {
        case 'admin-dashboard': return <AdminDashboardPage orders={orders} dishes={dishes} setPage={setPage} />;
        case 'admin-plats': return <AdminDishesPage dishes={dishes} onUpdateDishes={handleUpdateDishes} />;
        case 'admin-commandes': return <AdminOrdersPage showNotification={showNotification} orders={orders} onUpdateOrders={handleUpdateOrders}/>;
        case 'admin-traiteur': return <AdminCateringPage />;
        case 'admin-boxs': return <AdminBoxesPage boxes={boxes} onUpdateBoxes={handleUpdateBoxes} showNotification={showNotification}/>;
        case 'admin-compte': return <AdminAccountPage currentUser={currentUser} />; // Pass currentUser
        case 'admin-contact': return <AdminContactPage />;
        case 'admin-parametres': return <AdminSettingsPage settings={settings} onUpdateSettings={handleUpdateSettings} showNotification={showNotification}/>;
        case 'admin-marketing': return <AdminMarketingPage />;
        case 'admin-ai': return <AdminAiAssistant orders={orders} dishes={dishes} />;
        default: return <AdminDashboardPage orders={orders} dishes={dishes} setPage={setPage} />;
     }
  }

  if (isAdmin) {
    return (
        <AdminLayout currentPage={page} setPage={setPage} onLogout={handleLogout} currentUser={currentUser}>
            {renderAdminPage()}
        </AdminLayout>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-200 antialiased font-sans selection:bg-cyan-500/30 selection:text-cyan-200 min-h-screen relative">
      <AnimatedBackground />
      <Notification notifications={notifications} />
      <ClientHeader currentPage={page} setPage={setPage} settings={settings} />
      <main className="pb-24 min-h-screen relative z-10">
        {renderClientPage()}
      </main>
      <ClientBottomNav currentPage={page} setPage={setPage} cart={cart} />
    </div>
  );
};

export default App;
