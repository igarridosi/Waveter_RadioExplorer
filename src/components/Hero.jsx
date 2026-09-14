import PropTypes from 'prop-types';
import { Shuffle } from '@phosphor-icons/react';

// The brand moment: wordmark with its white rules, the line, one sentence, one action.
export default function Hero({ onRandom, busy }) {
  return (
    <div className="flex flex-col items-start gap-4 md:gap-6 lg:pt-6">
      <h1 className="inline-block border-y-[3px] border-zinc-50 py-2 text-[clamp(2.75rem,12vw,5.5rem)] font-black uppercase leading-none tracking-tight text-signal font-stretch-125 drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
        Waveter
      </h1>
      <p className="text-lg font-bold uppercase tracking-wide text-zinc-50 md:text-2xl">
        Your global radio
      </p>
      <p className="hidden max-w-[42ch] text-base leading-relaxed text-zinc-300 md:block md:text-lg">
        Tired of the same local channels? Let <em className="font-semibold text-zinc-100 not-italic">Waveter</em> take you on an auditory journey around the globe.
      </p>
      <button
        type="button"
        onClick={onRandom}
        disabled={busy}
        className="inline-flex h-12 items-center gap-2.5 rounded-full bg-signal px-6 text-base font-bold text-zinc-950 transition-[transform,background-color] duration-100 hover:bg-[#ff5a24] active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
      >
        <Shuffle size={20} weight="bold" aria-hidden="true" />
        {busy ? 'Spinning the dial' : 'Random dial'}
      </button>
    </div>
  );
}

Hero.propTypes = {
  onRandom: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};
