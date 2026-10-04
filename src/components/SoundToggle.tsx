import { useEffect, useState } from 'react';
import { setSoundEnabled, soundEnabled } from '../audio/sfx';

export function SoundToggle() {
  const [enabled, setEnabled] = useState(soundEnabled);
  useEffect(() => {
    const update = () => setEnabled(soundEnabled());
    window.addEventListener('g-card-sound-change', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('g-card-sound-change', update); window.removeEventListener('storage', update); };
  }, []);
  return <button type="button" className="sound-toggle" aria-label={`効果音を${enabled ? 'オフ' : 'オン'}にする`} aria-pressed={enabled} title={`効果音 ${enabled ? 'オン' : 'オフ'}`} onClick={() => setSoundEnabled(!enabled)}>{enabled ? '♪ ON' : '♪ OFF'}</button>;
}
