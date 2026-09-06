import { Routes, Route } from 'react-router'
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

export default function App() {
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      <WhatsAppFab />
    </>
  )
}
