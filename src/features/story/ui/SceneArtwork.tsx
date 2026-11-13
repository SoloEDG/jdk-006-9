import type { SceneId } from "../../../shared/types";
export function SceneArtwork({ sceneId }: { sceneId: SceneId }) {
  const tower = sceneId === "tower" || sceneId === "finale",
    warm = sceneId === "interview";
  return (
    <svg
      className="scene-art"
      viewBox="0 0 1000 420"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={
        tower
          ? "海雾中的灯塔"
          : warm
            ? "守塔人屋中的旧收音机"
            : "雾港夜色和远处的灯塔"
      }
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor={warm ? "#353842" : "#152c3e"} />
          <stop offset="1" stopColor="#081621" />
        </linearGradient>
        <radialGradient id="fog">
          <stop stopColor="#99b3ba" stopOpacity=".23" />
          <stop offset="1" stopColor="#8298a0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam">
          <stop stopColor="#e7d9aa" stopOpacity=".28" />
          <stop offset="1" stopColor="#e7d9aa" stopOpacity="0" />
        </linearGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <pattern id="rain" width="31" height="47" patternUnits="userSpaceOnUse">
          <path
            d="M22 0 13 28"
            stroke="#a4bdc8"
            strokeWidth=".6"
            opacity=".17"
          />
        </pattern>
      </defs>
      <path fill="url(#sky)" d="M0 0h1000v420H0z" />
      <circle cx="790" cy="82" r="30" fill="#d8e0da" opacity=".1" />
      <ellipse cx="690" cy="110" rx="350" ry="115" fill="url(#fog)" />
      <path
        d="M0 286Q120 251 232 295T460 285T740 295T1000 273V420H0Z"
        fill="#0a1e29"
      />
      <path d="M0 329Q220 302 411 330T790 315T1000 334V420H0Z" fill="#081822" />
      {warm ? (
        <g>
          <rect
            x="260"
            y="130"
            width="450"
            height="220"
            rx="12"
            fill="#23313a"
            stroke="#62727b"
            strokeWidth="2"
          />
          <rect
            x="282"
            y="152"
            width="200"
            height="174"
            rx="5"
            fill="#172832"
          />
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M295 ${164 + i * 18}h174`}
              stroke="#49606a"
              strokeWidth="4"
            />
          ))}
          <rect
            x="510"
            y="155"
            width="177"
            height="75"
            fill="#b0a078"
            opacity=".55"
          />
          {Array.from({ length: 15 }, (_, i) => (
            <path
              key={i}
              d={`M${520 + i * 11} 165v${i % 3 === 0 ? 25 : 12}`}
              stroke="#29383a"
              strokeWidth="1"
            />
          ))}
          <path d="M597 158v68" stroke="#d6b283" strokeWidth="2" />
          <circle cx="553" cy="281" r="24" fill="#162731" stroke="#738486" />
          <circle cx="644" cy="281" r="24" fill="#162731" stroke="#738486" />
          <path d="m310 130-40-97" stroke="#617980" strokeWidth="3" />
        </g>
      ) : (
        <g>
          <path d="M690 153 270 63 260 207Z" fill="url(#beam)" />
          <path d="M681 155h39l21 164h-79z" fill="#70828a" opacity=".55" />
          <path d="M681 155h39l7 56h-53z" fill="#354d5a" />
          <rect
            x="675"
            y="134"
            width="51"
            height="25"
            fill="#a8b5af"
            opacity=".5"
          />
          <rect
            x="682"
            y="138"
            width="37"
            height="16"
            fill="#e9d8a4"
            opacity={tower ? ".8" : ".45"}
          />
          <path d="m669 134 31-30 32 30z" fill="#172e3c" stroke="#607b87" />
          <path d="M700 105V87" stroke="#77909a" />
          <path d="M644 319 758 318 809 351H595z" fill="#152e3a" />
          <path
            d="M0 385 181 352 283 366 392 350 514 368 647 350 804 369 1000 348V420H0Z"
            fill="#07131d"
          />
          <path
            d="M110 340v66m93-67v61m-109-57h170"
            stroke="#183440"
            strokeWidth="6"
          />
          <path d="m334 348 88-6 41 18-90 4z" fill="#213e4a" />
          <path
            d="m386 345 4-52 45 48"
            fill="none"
            stroke="#314e58"
            strokeWidth="2"
          />
        </g>
      )}
      <ellipse
        cx="470"
        cy="338"
        rx="540"
        ry="65"
        fill="url(#fog)"
        filter="url(#blur)"
      />
      <rect width="1000" height="420" fill="url(#rain)" />
      <path
        d="M0 394Q250 377 500 396T1000 389"
        fill="none"
        stroke="#587583"
        opacity=".15"
      />
      <rect width="1000" height="420" fill="#031019" opacity=".12" />
    </svg>
  );
}
