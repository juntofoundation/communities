// helper functions
export function closeMenu(menuId: string) {
  const menu = document.getElementById(menuId);
  const items = menu?.shadowRoot?.querySelector("details");
  if (items) items.open = false;
}

// svgs
export function ChevronUpSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z"
      />
    </svg>
  );
}

export function ChevronDownSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
      />
    </svg>
  );
}

export function ChevronRightSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512">
      <path
        fill="currentColor"
        d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"
      />
    </svg>
  );
}

export function CurveSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="60" version="1.1" viewBox="0 0 10.054 15.875">
      <g transform="translate(-3.39 -5.533)">
        <path
          fill="none"
          stroke="currentColor"
          strokeDasharray="none"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit="4"
          strokeOpacity="1"
          strokeWidth="1.587"
          d="M4.185 5.533c0 10.349 8.466 4.714 8.466 15.876"
        />
      </g>
    </svg>
  );
}
