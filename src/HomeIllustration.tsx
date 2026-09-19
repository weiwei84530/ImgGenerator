export function HomeIllustration({ kind }: { kind: 'image' | 'video' | 'chat' }) {
  return (
    <svg
      className="home-illustration"
      viewBox="0 0 180 160"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'image' && (
        <>
          <g transform="rotate(-10 84 81)">
            <rect x="32" y="24" width="100" height="120" rx="6" fill="#c4d1bd" />
          </g>
          <g className="illustration-paper" transform="rotate(9 98 80)">
            <rect x="49" y="16" width="102" height="128" rx="5" fill="#fffdf5" />
            <path d="M56 23H144V121H56Z" fill="#d5dfc9" />
            <circle cx="122" cy="45" r="15" fill="#f3e3aa" />
            <path d="M56 88C82 62 107 78 144 66V121H56Z" fill="#a9bc9d" />
            <path d="M56 101C85 82 116 88 144 98V121H56Z" fill="#78977d" />
          </g>
          <path d="m32 43 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#fffdf5" />
          <path d="m151 118 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#7e997b" />
        </>
      )}
      {kind === 'video' && (
        <>
          <g transform="rotate(-10 91 75)">
            <rect x="28" y="27" width="125" height="89" rx="7" fill="#b5cbc6" />
            <path d="M38 39H143M38 47H104" stroke="#e8f0eb" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g className="illustration-paper" transform="rotate(7 92 87)">
            <rect x="23" y="44" width="137" height="96" rx="7" fill="#fcfdf7" />
            <path d="M30 51H153V120H30Z" fill="#c6d9d6" />
            <circle cx="129" cy="68" r="12" fill="#f0dfb6" />
            <path d="M30 97C66 73 103 83 153 94V120H30Z" fill="#8baca7" />
            <path d="M30 111C67 95 111 109 153 99V120H30Z" fill="#688b8c" />
            <circle cx="92" cy="85" r="20" fill="#fffdf5" fillOpacity="0.95" />
            <path d="m87 75 15 10-15 10Z" fill="#50787a" />
            <path d="M35 130H144" stroke="#dde7e1" strokeWidth="3" strokeLinecap="round" />
            <path d="M35 130H76" stroke="#86a5a0" strokeWidth="3" strokeLinecap="round" />
            <circle cx="77" cy="130" r="3" fill="#50787a" />
          </g>
          <path d="m155 22 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#6d9690" />
        </>
      )}
      {kind === 'chat' && (
        <>
          <g transform="rotate(8 113 101)">
            <path
              d="M79 69H145Q155 69 155 79V115Q155 125 145 125H138L139 141 119 125H79Q69 125 69 115V79Q69 69 79 69Z"
              fill="#d5bb94"
            />
            <path
              d="M89 89H136M89 101H123"
              stroke="#fff8e9"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          <g className="illustration-paper" transform="rotate(-7 79 69)">
            <path
              d="M35 29H120Q132 29 132 41V84Q132 96 120 96H65L44 112 46 96H35Q23 96 23 84V41Q23 29 35 29Z"
              fill="#fffdf5"
            />
            <circle cx="55" cy="63" r="5" fill="#aa8b5d" />
            <circle cx="78" cy="63" r="5" fill="#aa8b5d" />
            <circle cx="101" cy="63" r="5" fill="#aa8b5d" />
          </g>
          <path d="m148 33 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#c6a16a" />
          <path d="m31 121 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#fffdf5" />
        </>
      )}
    </svg>
  );
}
