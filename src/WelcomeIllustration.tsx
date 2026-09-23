const landscapes = [
  {
    transform: 'translate(32 65) rotate(-17 70 79)',
    sky: '#c1d1c3',
    sun: [91, 38, 24],
    sunlight: '#f8e9b4',
    distant: 'M8 101C42 74 77 59 132 69V130H8Z',
    foreground: 'M8 130C48 108 93 84 132 91V130Z',
    hill: '#648976',
    meadow: '#9dae82',
    marker: '#658a77',
    symbol: 'M0 3C-2 0-6 1-6 4C-6 7 0 11 0 11S6 7 6 4C6 1 2 0 0 3Z',
  },
  {
    transform: 'translate(152 29) rotate(5 70 79)',
    sky: '#e3ddc5',
    sun: [39, 35, 16],
    sunlight: '#fff0c2',
    distant: 'M8 66C49 58 82 73 132 102V130H8Z',
    foreground: 'M8 104C41 86 72 91 132 119V130H8Z',
    hill: '#929e79',
    meadow: '#b5ba91',
    marker: '#b69a65',
    symbol: 'M0 0 1.9 3.8 6.1 4.4 3 7.4 3.7 11.6 0 9.6-3.7 11.6-3 7.4-6.1 4.4-1.9 3.8Z',
  },
  {
    transform: 'translate(270 72) rotate(14 70 79)',
    sky: '#c7d7db',
    sun: [83, 54, 20],
    sunlight: '#f5e7bf',
    distant: 'M8 91C32 76 44 87 70 86S108 57 132 68V130H8Z',
    foreground: 'M8 114C43 91 75 106 98 111S120 108 132 103V130H8Z',
    hill: '#759698',
    meadow: '#a4bcb1',
    marker: '#7f9ba9',
    symbol:
      'M0 0C-1 2-6 4.5-6 7C-6 10-2 11 0 8C0 10-1 11-2.2 12H2.2C1 11 0 10 0 8C2 11 6 10 6 7C6 4.5 1 2 0 0Z',
  },
];

export function WelcomeIllustration() {
  return (
    <svg
      className="paper-art"
      viewBox="0 0 440 260"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {landscapes.map((scene) => (
        <g key={scene.marker} transform={scene.transform}>
          <rect className="welcome-photo-paper" width="140" height="158" rx="3" fill="#fffdf7" />
          <path d="M8 8H132V130H8Z" fill={scene.sky} />
          <circle cx={scene.sun[0]} cy={scene.sun[1]} r={scene.sun[2]} fill={scene.sunlight} />
          <path d={scene.distant} fill={scene.hill} />
          <path d={scene.foreground} fill={scene.meadow} />
          <path d={scene.symbol} transform="translate(19 138)" fill={scene.marker} />
        </g>
      ))}
      <path d="M402 14Q405 29 418 32Q405 35 402 50Q399 35 386 32Q399 29 402 14Z" fill="#849c7c" />
      <path d="m27 36 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#caa75a" />
      <path d="m419 231 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#93a787" />
      <path d="m429 60 1.5 4.5L435 66l-4.5 1.5L429 72l-1.5-4.5L423 66l4.5-1.5Z" fill="#caa75a" />
      <circle cx="15" cy="68" r="2" fill="#caa75a" opacity=".6" />
      <circle cx="427" cy="215" r="2" fill="#caa75a" opacity=".6" />
    </svg>
  );
}
