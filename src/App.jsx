import { useCallback, useState } from 'react';
import { Heart } from '@phosphor-icons/react';
import marconi from '/marconi.jpg';
import { catalogue } from './catalogue';
import { useTuner } from './tuner/useTuner.js';
import { usePlayer } from './player/usePlayer.js';
import { useFavourites } from './favourites/useFavourites.js';
import Hero from './components/Hero.jsx';
import Tuner from './components/Tuner.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import FavouritesDrawer from './components/FavouritesDrawer.jsx';

// Composition root: the Tuner decides what is selected, the Player makes it audible.
export default function App() {
  const tuner = useTuner(catalogue);
  const player = usePlayer();
  const favourites = useFavourites();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const tune = useCallback(station => {
    tuner.tune(station);
    player.play(station, catalogue.streamFor(station));
  }, [tuner, player]);

  const spinDial = useCallback(async () => {
    setSpinning(true);
    try {
      const station = await tuner.tuneRandom();
      player.play(station, catalogue.streamFor(station));
    } catch (error) {
      console.error('Random dial failed:', error);
    } finally {
      setSpinning(false);
    }
  }, [tuner, player]);

  const tuneFromDrawer = useCallback(station => {
    setDrawerOpen(false);
    tune(station);
  }, [tune]);

  return (
    <div className="relative min-h-[100dvh]">
      {/* The photograph and its veil: fixed, behind everything. */}
      <div
        className="hero-photo pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${marconi})` }}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-0 bg-zinc-950/80 lg:bg-gradient-to-r lg:from-zinc-950/95 lg:via-zinc-950/75 lg:to-zinc-950/55" aria-hidden="true" />

      <header className="relative mx-auto flex max-w-[1400px] items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Saved radios${favourites.list.length ? `, ${favourites.list.length}` : ''}`}
          className="tap inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-zinc-100"
        >
          <Heart size={20} weight="bold" aria-hidden="true" />
          <span className="hidden md:inline">Saved radios</span>
          {favourites.list.length > 0 && (
            <span className="rounded-full bg-zinc-50 px-1.5 text-xs font-bold tabular-nums text-zinc-950">{favourites.list.length}</span>
          )}
        </button>
      </header>

      <main className="relative mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 md:gap-10 md:px-8 md:pt-14 lg:grid-cols-12 lg:gap-14 lg:pt-16">
        <div className="lg:col-span-5">
          <Hero onRandom={spinDial} busy={spinning} />
        </div>
        <div className="lg:col-span-7">
          <Tuner tuner={tuner} onTune={tune} />
        </div>
      </main>

      <PlayerBar
        player={player}
        saved={player.station ? favourites.has(player.station.id) : false}
        onToggleSave={favourites.toggle}
      />

      <FavouritesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        favourites={favourites.list}
        tunedId={player.station?.id}
        onTune={tuneFromDrawer}
        onRemove={favourites.remove}
      />
    </div>
  );
}
