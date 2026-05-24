import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Lobby } from './components/Lobby';
import { GameView } from './components/GameView';
import { useViewportHeight } from './hooks/useViewportHeight';

export default function App() {
  useViewportHeight();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/match/:id" element={<GameView />} />
      </Routes>
    </BrowserRouter>
  );
}
