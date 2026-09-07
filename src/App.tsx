import { lazy, Suspense, type ComponentType } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import ErrorBoundary from './components/app/ErrorBoundary'
import RouteFallback from './components/app/RouteFallback'
import BottomNav from './components/app/BottomNav'

/**
 * Ruting (OTA-192): hver side lastes lat per rute. Hele admin-treet ligger i
 * ÉN chunk (src/pages/admin/index.ts) slik at kundesider aldri laster admin-kode,
 * og admin ikke laster på nytt mellom seksjoner.
 */

// ── Kundesider ──────────────────────────────────────────────────────────────
const Home = lazy(() => import('./pages/Home'))
const Explore = lazy(() => import('./pages/Explore'))
const Journal = lazy(() => import('./pages/Journal'))
const JournalArticle = lazy(() => import('./pages/JournalArticle'))
const DestinationPage = lazy(() => import('./pages/DestinationPage'))
const Saved = lazy(() => import('./pages/Saved'))
const Profile = lazy(() => import('./pages/Profile'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const Checkout = lazy(() => import('./pages/Checkout'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const MyTrip = lazy(() => import('./pages/MyTrip'))
const FlightStatus = lazy(() => import('./pages/FlightStatus'))
const Support = lazy(() => import('./pages/Support'))
const Destinations = lazy(() => import('./pages/Destinations'))
const Quiz = lazy(() => import('./pages/Quiz'))
const HotelCar = lazy(() => import('./pages/HotelCar'))
const StayResults = lazy(() => import('./pages/StayResults'))
const QuotePage = lazy(() => import('./pages/QuotePage'))
const Auth = lazy(() => import('./pages/Auth'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Community = lazy(() => import('./pages/Community'))
const EditProfile = lazy(() => import('./pages/account/EditProfile'))
const Travelers = lazy(() => import('./pages/account/Travelers'))
const PriceAlerts = lazy(() => import('./pages/account/PriceAlerts'))
const PriceWatches = lazy(() => import('./pages/account/PriceWatches'))
const TravelProfilePage = lazy(() => import('./pages/account/TravelProfile'))
const Onboarding = lazy(() => import('./pages/account/Onboarding'))
const Notifications = lazy(() => import('./pages/account/Notifications'))
const Security = lazy(() => import('./pages/account/Security'))
const Rewards = lazy(() => import('./pages/account/Rewards'))
const Referral = lazy(() => import('./pages/account/Referral'))
const Trips = lazy(() => import('./pages/Trips'))
const MatchSession = lazy(() => import('./pages/MatchSession'))
const Boards = lazy(() => import('./pages/Boards'))
const BoardPage = lazy(() => import('./pages/Board'))
const VerifyEmail = lazy(() => import('./pages/account/VerifyEmail'))
const Receipt = lazy(() => import('./pages/account/Receipt'))
const Terms = lazy(() => import('./pages/content/Terms'))
const Privacy = lazy(() => import('./pages/content/Privacy'))
const Baggage = lazy(() => import('./pages/content/Baggage'))
const Visa = lazy(() => import('./pages/content/Visa'))
const About = lazy(() => import('./pages/content/About'))
const NotFound = lazy(() => import('./pages/NotFound'))
const GlyphSheet = lazy(() => import('./pages/GlyphSheet'))
const WhatsAppFab = lazy(() => import('./components/WhatsAppFab'))

// ── Admin: én felles chunk ──────────────────────────────────────────────────
type AdminModule = typeof import('./pages/admin')
const adminChunk = () => import('./pages/admin')
function adminLazy<K extends keyof AdminModule>(name: K) {
  return lazy(() => adminChunk().then((m) => ({ default: m[name] as unknown as ComponentType })))
}
const AdminLogin = adminLazy('AdminLogin')
const AdminActivate = adminLazy('AdminActivate')
const AdminLayout = adminLazy('AdminLayout')
const AdminOverview = adminLazy('AdminOverview')
const AdminBookings = adminLazy('AdminBookings')
const AdminBookingDetail = adminLazy('AdminBookingDetail')
const AdminQuotes = adminLazy('AdminQuotes')
const AdminCustomers = adminLazy('AdminCustomers')
const AdminPayments = adminLazy('AdminPayments')
const AdminRefunds = adminLazy('AdminRefunds')
const AdminCases = adminLazy('AdminCases')
const AdminReports = adminLazy('AdminReports')
const AdminAudit = adminLazy('AdminAudit')
const AdminSettings = adminLazy('AdminSettings')
const AdminReviewQueue = adminLazy('AdminReviewQueue')
const AdminScheduleChanges = adminLazy('AdminScheduleChanges')
const AdminFraudFlags = adminLazy('AdminFraudFlags')
const AdminCheckoutSessions = adminLazy('AdminCheckoutSessions')
const AdminCommunity = adminLazy('AdminCommunity')
const AdminMessages = adminLazy('AdminMessages')
const AdminNotes = adminLazy('AdminNotes')
const AdminProblems = adminLazy('AdminProblems')
const AdminPayroll = adminLazy('AdminPayroll')
const AdminPartners = adminLazy('AdminPartners')
const AdminManualBooking = adminLazy('AdminManualBooking')
const AdminReceipt = adminLazy('AdminReceipt')

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback admin={isAdmin} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/utforsk" element={<Explore />} />
            <Route path="/lagret" element={<Saved />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/sok" element={<SearchResults />} />
            <Route path="/bestill" element={<Checkout />} />
            <Route path="/bekreftelse/:orderId" element={<Confirmation />} />
            <Route path="/reise" element={<MyTrip />} />
            <Route path="/flystatus" element={<FlightStatus />} />
            <Route path="/hjelp" element={<Support />} />
            <Route path="/reisemal" element={<Destinations />} />
            <Route path="/reisemal/:id" element={<DestinationPage />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/:slug" element={<JournalArticle />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quiz/:mode" element={<Quiz />} />
            <Route path="/m/:token" element={<MatchSession />} />
            <Route path="/tavler" element={<Boards />} />
            <Route path="/tavler/:token" element={<BoardPage />} />
            <Route path="/hotell-bil" element={<HotelCar />} />
            <Route path="/overnatting-bil" element={<StayResults />} />
            <Route path="/tilbud/:token" element={<QuotePage />} />
            <Route path="/logg-inn" element={<Auth />} />
            <Route path="/tilbakestill-passord" element={<ResetPassword />} />
            <Route path="/samfunn" element={<Community />} />
            <Route path="/bekreft-epost" element={<VerifyEmail />} />
            <Route path="/profil/rediger" element={<EditProfile />} />
            <Route path="/profil/reisende" element={<Travelers />} />
            <Route path="/profil/prisvarsler" element={<PriceAlerts />} />
            <Route path="/profil/prisovervaking" element={<PriceWatches />} />
            <Route path="/profil/reiseprofil" element={<TravelProfilePage />} />
            <Route path="/profil/varsler" element={<Notifications />} />
            <Route path="/profil/sikkerhet" element={<Security />} />
            <Route path="/profil/bonus" element={<Rewards />} />
            <Route path="/profil/inviter" element={<Referral />} />
            <Route path="/velkommen" element={<Onboarding />} />
            <Route path="/reiser" element={<Trips />} />
            <Route path="/kvittering/:orderId" element={<Receipt />} />
            <Route path="/vilkar" element={<Terms />} />
            <Route path="/personvern" element={<Privacy />} />
            <Route path="/bagasje" element={<Baggage />} />
            <Route path="/visum" element={<Visa />} />
            <Route path="/om-oss" element={<About />} />

            <Route path="/admin/logg-inn" element={<AdminLogin />} />
            <Route path="/admin/aktiver" element={<AdminActivate />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="ny-bestilling" element={<AdminManualBooking />} />
              <Route path="kvittering/:id" element={<AdminReceipt />} />
              <Route path="meldinger" element={<AdminMessages />} />
              <Route path="notater" element={<AdminNotes />} />
              <Route path="problemer" element={<AdminProblems />} />
              <Route path="lonn" element={<AdminPayroll />} />
              <Route path="hotell-bil" element={<AdminPartners />} />
              <Route path="bestillinger" element={<AdminBookings />} />
              <Route path="bestillinger/:id" element={<AdminBookingDetail />} />
              <Route path="gjennomgang" element={<AdminReviewQueue />} />
              <Route path="ruteendringer" element={<AdminScheduleChanges />} />
              <Route path="svindel" element={<AdminFraudFlags />} />
              <Route path="sesjoner" element={<AdminCheckoutSessions />} />
              <Route path="tilbud" element={<AdminQuotes />} />
              <Route path="kunder" element={<AdminCustomers />} />
              <Route path="betalinger" element={<AdminPayments />} />
              <Route path="refusjoner" element={<AdminRefunds />} />
              <Route path="kundeservice" element={<AdminCases />} />
              <Route path="samfunn" element={<AdminCommunity />} />
              <Route path="rapporter" element={<AdminReports />} />
              <Route path="aktivitetslogg" element={<AdminAudit />} />
              <Route path="innstillinger" element={<AdminSettings />} />
            </Route>

            <Route path="/utvikler/ikoner" element={<GlyphSheet />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      {!isAdmin && (
        <Suspense fallback={null}>
          <WhatsAppFab />
        </Suspense>
      )}
      <BottomNav />
    </>
  )
}
