import ChapaReconciliation from '@/components/ChapaReconciliation';
import { circleLoginPath } from '@/lib/authReturnPath';
import React, { useState, useEffect, useLayoutEffect, useCallback, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { StoryProvider } from "@/contexts/StoryContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { UploadProvider } from "@/contexts/UploadContext";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { AppLoader } from "@/components/AppLoader";
import UploadProgressOverlay from "@/components/UploadProgressOverlay";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { ForceReinstallOverlay } from "@/components/ForceReinstallOverlay";
import { IncomingHelperRequestAlert } from "@/components/safe/IncomingHelperRequestAlert";
import { SerkleLoader } from "@/components/ui/SerkleLoader";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import AdminRoute from "@/components/AdminRoute";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { cacheManager, isFilePickerActive } from "@/utils/cacheManager";
import { createIDBPersister, PERSIST_MAX_AGE, requestPersistentStorage } from "@/utils/queryPersister";
import UpdateNotifier from "@/components/UpdateNotifier";
import GlobalRealtimeListener from "@/components/GlobalRealtimeListener";

// ─── Route-Level Code Splitting ─────────────────────────────────────
// All pages are lazy-loaded to reduce initial bundle size by 60-80%
const Index = React.lazy(() => import("./pages/Index"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Shop = React.lazy(() => import("./pages/Shop"));
const Ask = React.lazy(() => import("./pages/Ask"));
const QuestionDetail = React.lazy(() => import("./pages/QuestionDetail"));
const AskProfile = React.lazy(() => import("./pages/AskProfile"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail"));
const SellerProfile = React.lazy(() => import("./pages/SellerProfile"));
const Cart = React.lazy(() => import("./pages/Cart"));
const SOSSubCategories = React.lazy(() => import("./pages/SOSSubCategories").then(m => ({ default: m.SOSSubCategories })));
const CircleDetailWrapper = React.lazy(() => import("./components/CircleDetailWrapper"));
const CirclePostDetail = React.lazy(() => import("./pages/CirclePostDetail"));
const CircleDashboard = React.lazy(() => import("./pages/CircleDashboard"));
const PostDetail = React.lazy(() => import("./pages/PostDetail"));
const CreatePost = React.lazy(() => import("./pages/CreatePost"));
const Share = React.lazy(() => import("./pages/Share"));
const CreateVideo = React.lazy(() => import("./pages/CreateVideo"));
const CreateCircle = React.lazy(() => import("./pages/CreateCircle"));
const CreateShop = React.lazy(() => import("./pages/CreateShop"));
const SellerDashboard = React.lazy(() => import("./pages/SellerDashboard"));
const OrderHistory = React.lazy(() => import("./pages/OrderHistory"));
const OrderDetail = React.lazy(() => import("./pages/OrderDetail"));
const Wishlist = React.lazy(() => import("./pages/Wishlist"));
const Disputes = React.lazy(() => import("./pages/Disputes"));
const ShopMessages = React.lazy(() => import("./pages/ShopMessages"));
const ShippingAddresses = React.lazy(() => import("./pages/ShippingAddresses"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const VideoDetail = React.lazy(() => import("./pages/VideoDetail"));
const JoinCircle = React.lazy(() => import("./pages/JoinCircle"));
const EmailAddress = React.lazy(() => import("./pages/EmailAddress"));
const TestPush = React.lazy(() => import("./pages/TestPush"));
const VerifyTopUp = React.lazy(() => import("./pages/VerifyTopUp"));

// Admin pages - lazy loaded
const AdminLayout = React.lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminPosts = React.lazy(() => import("./pages/admin/AdminPosts"));
const AdminVideos = React.lazy(() => import("./pages/admin/AdminVideos"));
const AdminAlerts = React.lazy(() => import("./pages/admin/AdminAlerts"));
const AdminRoles = React.lazy(() => import("./pages/admin/AdminRoles"));
const AdminReports = React.lazy(() => import("./pages/admin/AdminReports"));
const AdminAppeals = React.lazy(() => import("./pages/admin/AdminAppeals"));
const AdminComments = React.lazy(() => import("./pages/admin/AdminComments"));
const AdminMessagesOversight = React.lazy(() => import("./pages/admin/AdminMessagesOversight"));
const AdminAnalytics = React.lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));
const AdminAIModeration = React.lazy(() => import("./pages/admin/AdminAIModeration"));
const AdminAutoModeration = React.lazy(() => import("./pages/admin/AdminAutoModeration"));
const AdminBulkActions = React.lazy(() => import("./pages/admin/AdminBulkActions"));
const AdminWebhooks = React.lazy(() => import("./pages/admin/AdminWebhooks"));
const AdminEngagement = React.lazy(() => import("./pages/admin/AdminEngagement"));
const AdminContentQueue = React.lazy(() => import("./pages/admin/AdminContentQueue"));
const AdminAuditLog = React.lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminPlatformHealth = React.lazy(() => import("./pages/admin/AdminPlatformHealth"));
const AdminCommunication = React.lazy(() => import("./pages/admin/AdminCommunication"));
const AdminCircles = React.lazy(() => import("./pages/admin/AdminCircles"));
const AdminReporting = React.lazy(() => import("./pages/admin/AdminReporting"));
const AdminAskModeration = React.lazy(() => import("./pages/admin/AdminAskModeration"));
const AdminLiveStreams = React.lazy(() => import("./pages/admin/AdminLiveStreams"));
const AdminShopManagement = React.lazy(() => import("./pages/admin/AdminShopManagement"));
const AdminSafetyOperations = React.lazy(() => import("./pages/admin/AdminSafetyOperations"));
const AdminExpertVerification = React.lazy(() => import("./pages/admin/AdminExpertVerification"));

// ─── Query Client ───────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep cached data alive for persistence
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const persister = createIDBPersister();

// ─── Page Loading Fallback ──────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center bg-background">
    <SerkleLoader size="lg" />
  </div>
);

// ─── Route Guards ───────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useUser();
  const location = useLocation();
  
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <SerkleLoader size="lg" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to={circleLoginPath(location.pathname + location.search)} replace />;
  }
  
  return <>{children}</>;
};

const PresenceWrapper = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  return <PresenceProvider userId={user?.id}>{children}</PresenceProvider>;
};

// ─── App Routes ─────────────────────────────────────────────────────
// Inside Suspense: layout effects are cleaned up while a lazy route is hidden.
// Two frames also let auth redirects commit before declaring the screen ready.
const RouteReadySignal = ({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) => {
  const location = useLocation();
  const { isLoading } = useUser();
  const isRestoring = useIsRestoring();

  useLayoutEffect(() => {
    onReadyChange(false);
    let secondFrame = 0;
    const firstFrame = !isLoading && !isRestoring
      ? window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => onReadyChange(true));
        })
      : 0;
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      onReadyChange(false);
    };
  }, [location.key, isLoading, isRestoring, onReadyChange]);

  return null;
};

const AppRoutes = ({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) => {
  useAndroidBackButton();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/share" element={<Share />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/messages/:conversationId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/shop" element={<ProtectedRoute><Shop activeTab="shop" onTabSelect={() => {}} onOpenCreate={() => {}} /></ProtectedRoute>} />
      <Route path="/shop/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
      <Route path="/order/:orderId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/seller/dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
      <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
      <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
      <Route path="/seller/:sellerId" element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
      <Route path="/shop/messages" element={<ProtectedRoute><ShopMessages /></ProtectedRoute>} />
      <Route path="/shop/messages/:conversationId" element={<ProtectedRoute><ShopMessages /></ProtectedRoute>} />
      <Route path="/shipping-addresses" element={<ProtectedRoute><ShippingAddresses /></ProtectedRoute>} />
      <Route path="/ask" element={<ProtectedRoute><Ask activeTab="ask" onTabSelect={() => {}} onOpenCreate={() => {}} /></ProtectedRoute>} />
      <Route path="/ask/profile" element={<ProtectedRoute><AskProfile /></ProtectedRoute>} />
      <Route path="/ask/question/:questionId" element={<ProtectedRoute><QuestionDetail /></ProtectedRoute>} />
      <Route path="/create/post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
      <Route path="/create/video" element={<ProtectedRoute><CreateVideo /></ProtectedRoute>} />
      <Route path="/create/circle" element={<ProtectedRoute><CreateCircle /></ProtectedRoute>} />
      <Route path="/create/shop" element={<ProtectedRoute><CreateShop /></ProtectedRoute>} />
      <Route path="/sos/:category" element={<ProtectedRoute><SOSSubCategories /></ProtectedRoute>} />
      <Route path="/post/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
      <Route path="/circle/:id" element={<ProtectedRoute><CircleDetailWrapper /></ProtectedRoute>} />
      <Route path="/circle/:id/dashboard" element={<ProtectedRoute><CircleDashboard /></ProtectedRoute>} />
      <Route path="/circle/:circleId/post/:postId" element={<ProtectedRoute><CirclePostDetail /></ProtectedRoute>} />
      <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/video/:videoId" element={<ProtectedRoute><VideoDetail /></ProtectedRoute>} />
      <Route path="/join/:inviteCode" element={<ProtectedRoute><JoinCircle /></ProtectedRoute>} />
      <Route path="/email-address" element={<ProtectedRoute><EmailAddress /></ProtectedRoute>} />
      <Route path="/test-push" element={<ProtectedRoute><TestPush /></ProtectedRoute>} />
      {/* Admin Dashboard Routes — protected by role-based AdminRoute */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="alerts" element={<AdminAlerts />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="roles" element={<AdminRoles />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="videos" element={<AdminVideos />} />
        <Route path="comments" element={<AdminComments />} />
        <Route path="messages" element={<AdminMessagesOversight />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="appeals" element={<AdminAppeals />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="ai-moderation" element={<AdminAIModeration />} />
        <Route path="auto-moderation" element={<AdminAutoModeration />} />
        <Route path="bulk-actions" element={<AdminBulkActions />} />
        <Route path="webhooks" element={<AdminWebhooks />} />
        <Route path="engagement" element={<AdminEngagement />} />
        <Route path="content-queue" element={<AdminContentQueue />} />
        <Route path="audit-log" element={<AdminAuditLog />} />
        <Route path="platform-health" element={<AdminPlatformHealth />} />
        <Route path="communication" element={<AdminCommunication />} />
        <Route path="circles" element={<AdminCircles />} />
        <Route path="reporting" element={<AdminReporting />} />
        <Route path="ask-moderation" element={<AdminAskModeration />} />
        <Route path="live-streams" element={<AdminLiveStreams />} />
        <Route path="shop" element={<AdminShopManagement />} />
        <Route path="safety" element={<AdminSafetyOperations />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="expert-verification" element={<AdminExpertVerification />} />
      </Route>
      <Route path="/verify" element={<VerifyTopUp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
      <RouteReadySignal onReadyChange={onReadyChange} />
    </Suspense>
  );
};

// ─── App Gate: single splash until app + auth + first page are ready ─
const AppGate = () => {
  const { isLoading: userLoading } = useUser();
  const [appReady, setAppReady] = useState(false);
  const [firstPageReady, setFirstPageReady] = useState(false);
  const [animationReachedExitPoint, setAnimationReachedExitPoint] = useState(false);
  const [startupFallbackReached, setStartupFallbackReached] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const readyForReveal = appReady && !userLoading && firstPageReady;
  const handleAnimationExitPoint = useCallback(
    () => setAnimationReachedExitPoint(true),
    [],
  );

  useEffect(() => {
    const initializeApp = async () => {
      try {
        requestPersistentStorage();
        const versionChanged = cacheManager.checkVersion();
        if (versionChanged) {
          console.log('App version changed, clearing caches...');
          queryClient.clear();
          cacheManager.updateVersion();
        }
        await queryClient.invalidateQueries();
        if (import.meta.env.PROD && !isFilePickerActive()) {
          await cacheManager.checkForUpdates();
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (animationReachedExitPoint && (readyForReveal || startupFallbackReached)) {
      setFadeOut(true);
    }
  }, [
    animationReachedExitPoint,
    readyForReveal,
    startupFallbackReached,
  ]);

  // Once the crossfade begins, later query/auth changes must not cancel removal.
  useEffect(() => {
    if (!fadeOut) return;
    const timer = window.setTimeout(() => setShowSplash(false), 320);
    return () => window.clearTimeout(timer);
  }, [fadeOut]);

  useEffect(() => {
    if (readyForReveal) return;

    const timer = window.setTimeout(() => {
      console.warn('Startup readiness timed out; handing control to the app shell.');
      setStartupFallbackReached(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [readyForReveal]);

  return (
    <>
      <div
        className={`serkle-app-layer ${fadeOut || !showSplash ? 'is-visible' : ''}`}
        aria-hidden={showSplash && !fadeOut}
      >
        <Toaster />
        <GlobalRealtimeListener />
        <ChapaReconciliation />
        <InstallPrompt />
        <UploadProgressOverlay />
        <ForceReinstallOverlay />
        <NotificationPermissionPrompt />
        <IncomingHelperRequestAlert />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UpdateNotifier />
          <AppRoutes onReadyChange={setFirstPageReady} />
        </BrowserRouter>
      </div>

      {showSplash && (
        <AppLoader
          fadeOut={fadeOut}
          onAnimationExitPoint={handleAnimationExitPoint}
        />
      )}
    </>
  );
};

// ─── Main App ───────────────────────────────────────────────────────
const App = () => {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: PERSIST_MAX_AGE,
            buster: import.meta.env.VITE_APP_VERSION || 'v1',
          }}
        >
          <UserProvider>
              <StoryProvider>
                <PresenceWrapper>
                <UploadProvider>
                  <CartProvider>
                    <TooltipProvider>
                      <NavigationProvider>
                        <AppGate />
                      </NavigationProvider>
                    </TooltipProvider>
                  </CartProvider>
                </UploadProvider>
                </PresenceWrapper>
              </StoryProvider>
          </UserProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
