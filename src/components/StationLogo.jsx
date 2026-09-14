import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Radio } from '@phosphor-icons/react';

// A station's logo, or a radio glyph when the station has none or the image fails.
export default function StationLogo({ src, size = 44, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);

  const box = { width: size, height: size };
  if (!src || broken) {
    return (
      <span style={box} className={`flex shrink-0 items-center justify-center rounded-[10px] bg-zinc-800 text-zinc-400 ${className}`} aria-hidden="true">
        <Radio size={Math.round(size / 2)} weight="bold" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={box}
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-[10px] bg-zinc-800 object-cover ${className}`}
    />
  );
}

StationLogo.propTypes = { src: PropTypes.string, size: PropTypes.number, className: PropTypes.string };
