import { Routes, Route, useLocation } from 'react-router'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import Checkout from './pages/Checkout'
import Confirmation from './pages/Confirmation'
import MyTrip from './pages/MyTrip'
import FlightStatus from './pages/FlightStatus'
import Support from './pages/Support'
import Destinations from './pages/Destinations'
import NotFound from './pages/NotFound'
import WhatsAppFab from './components/WhatsAppFab'
import AdminLogin from './pages/admin/AdminLogin'
import AdminActivate from './pages/admin/AdminActivate'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverview } from './pages/admin/AdminOverview'
import { AdminBookings } from './pages/admin/AdminBookings'
import { AdminBookingDetail } from './pages/admin/AdminBookingDetail'
import {
  AdminQuotes,
  AdminCustomers,
  AdminPayments,
  AdminRefunds,
  AdminCases,
  AdminReports,
  AdminAudit,
  AdminSettings,
} from './pages/admin/AdminSections'

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sok" element={<SearchResults />} />
        <Route path="/bestill" element={<Checkout />} />
        <Route path="/bekreftelse/:orderId" element={<Confirmation />} />
        <Route path="/reise" element={<MyTrip />} />
        <Route path="/flystatus" element={<FlightStatus />} />
        <Route path="/hjelp" element={<Support />} />
        <Route path="/reisemal" element={<Destinations />} />

        <Route path="/admin/logg-inn" element={<AdminLogin />} />
        <Route path="/admin/aktiver" element={<AdminActivate />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="bestillinger" element={<AdminBookings />} />
          <Route path="bestillinger/:id" element={<AdminBookingDetail />} />
          <Route path="tilbud" element={<AdminQuotes />} />
          <Route path="kunder" element={<AdminCustomers />} />
          <Route path="betalinger" element={<AdminPayments />} />
          <Route path="refusjoner" element={<AdminRefunds />} />
          <Route path="kundeservice" element={<AdminCases />} />
          <Route path="rapporter" element={<AdminReports />} />
          <Route path="aktivitetslogg" element={<AdminAudit />} />
          <Route path="innstillinger" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isAdmin && <WhatsAppFab />}
    </>
  )
}
