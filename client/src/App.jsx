import { Routes, Route } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import PracticePage from './pages/PracticePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/practice" element={<PracticePage />} />
    </Routes>
  );
}