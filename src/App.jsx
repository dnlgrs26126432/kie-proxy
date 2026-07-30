import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Studio from "./pages/Studio.jsx";

// Shell di routing: home (galleria progetti) + studio (console di generazione).
export default function App() {
return (
<Routes>
<Route path="/" element={<Home />} />
<Route path="/studio" element={<Studio />} />
<Route path="/studio/:id" element={<Studio />} />
<Route path="*" element={<Home />} />
</Routes>
);
}
