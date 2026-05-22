export function GooFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <filter id="goo-filter" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blur" id="goo-blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            id="goo-matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
          />
        </filter>
      </defs>
    </svg>
  );
}
