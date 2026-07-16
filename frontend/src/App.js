import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import { TRIP, DAYS, GUIDES, DOCUMENTS } from "@/data/trip";
import { fetchDayBlocks } from "./dayContent";
import NoteBox from "./NoteBox";
import introFull from "@/data/intro_full.json";
import hotelsData from "@/data/hotels.json";
import flightsData from "@/data/flights.json";

const Icon = ({ name }) => <i className={`fa-solid fa-${name}`}></i>;

// Reusable tabs for day pages/subpages
function DayTabs({ day, active }) {
  const cls = (name) => `tab${active === name ? " active" : ""}`;
  const restoCount = day.restaurants.filter(r => !isChainRestaurant(r.name)).length;
  return (
    <div className="tabs" data-testid="day-tabs">
      <Link to={`/jour/${day.id}/lieux`} className={cls("lieux")} data-testid="tab-lieux">
        <Icon name="location-dot" /> Lieux ({day.places.length})
      </Link>
      <Link to={`/jour/${day.id}`} className={cls("recit")} data-testid="tab-recit">
        <Icon name="book-open" /> Le récit
      </Link>
      <Link to={`/jour/${day.id}/hotel`} className={cls("hotel")} data-testid="tab-hotel">
        <Icon name="bed" /> Hôtel
      </Link>
      <Link to={`/jour/${day.id}/manger`} className={cls("manger")} data-testid="tab-manger">
        <Icon name="utensils" /> Où Manger ({restoCount})
      </Link>
      <Link to={`/jour/${day.id}/note`} className={cls("note")} data-testid="tab-note">
        <Icon name="note-sticky" /> Note
      </Link>
    </div>
  );
}
function RichText({ text }) {
  if (!text) return null;
  const parts = [];
  const regex = /\[LINK\|([^|]+)\|([^\]]+)\]|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    const url = m[1] !== undefined ? m[1] : m[4];
    const label = m[1] !== undefined ? m[2] : m[3];
    parts.push(
      <a key={i++} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)", textDecoration: "underline" }}>
        {label}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

// Detect if a heading text is about restaurants (to filter these sections from récit)
const RESTO_HEADING_RE = /^(suggestion de restaurant|restaurant|resto|autres restaurant|autres suggestion|option[s]? de restauration|options? pour manger|autres options?|manger|petit-?d[ée]jeuner)/i;
function isRestoHeading(text) {
  if (!text) return false;
  return RESTO_HEADING_RE.test(text.trim());
}

// Common US chain restaurants — filter them out (user request: "il y en a partout")
const CHAINS = [
  "Wendy's","Wendy","Subway","Panda Express","Panda","Del Taco","Taco Bell",
  "McDonald's","McDonald","Burger King","In-N-Out","Five Guys","Chipotle",
  "Sonic Drive","Sonic","Denny's","Denny","Cracker Barrel","Chick-fil-A",
  "Popeyes","Arby's","Jack in the Box","Carl's Jr","Hardee's","Raising Cane",
  "Domino's","Pizza Hut","Papa John","Little Caesar","Starbucks","Dunkin",
  "Krispy Kreme","Applebee","Chili's","TGI Friday","Olive Garden","Red Lobster",
  "Red Robin","Outback Steakhouse","Buffalo Wild Wings","Texas Roadhouse","IHOP",
  "Waffle House","Panera","Freddy's Frozen","Freddy's","Shake Shack","Culver's",
  "White Castle","Steak 'n Shake","Steak'n Shake","Farmer Boys","Wingstop",
  "Church's Chicken","El Pollo Loco","Sprinkles","Krispy Krunchy","Trader Joe",
  "Safeway","Walmart","Target","Costco","Ralph's","Whole Foods","Bagel Nosh",
  "Smashburger"
];
const CHAINS_RE = new RegExp("(" + CHAINS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "i");
function mentionsChain(text) {
  if (!text) return false;
  // Exception: Taco Bell Cantina at Pacifica State Beach is a legit ocean-view attraction
  if (/taco bell cantina/i.test(text)) return false;
  return CHAINS_RE.test(text);
}
function isChainRestaurant(name) {
  if (!name) return false;
  return CHAINS_RE.test(name);
}

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function RenderBlocks({ blocks }) {
  if (!blocks || blocks.length === 0) return null;
  // Filter out restaurant sections: from a resto heading, skip until next H heading OR "* Nuit" paragraph
  const filtered = [];
  let skip = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if ((b.type === "h1" || b.type === "h2" || b.type === "h3" || b.type === "h4")) {
      if (isRestoHeading(b.text)) { skip = true; continue; }
      skip = false;
    }
    if (skip) {
      if (b.type === "p" && /^\s*\*\s*Nuit/i.test(b.text)) {
        skip = false;
        filtered.push(b);
      }
      continue;
    }
    // Also drop individual paragraphs that mention fast-food chains (per user request)
    if (b.type === "p" && mentionsChain(b.text)) continue;
    filtered.push(b);
  }
  return (
    <>
      {filtered.map((b, i) => {
        if (b.type === "img") {
          return (
            <figure key={i} className="story-figure" data-testid={`story-img-${i}`}>
              <img src={b.src} alt="" loading="lazy" onError={(e) => (e.target.parentElement.style.display = "none")} />
            </figure>
          );
        }
        if (b.type === "doc") {
          // Derive PDF/EPUB from Google Doc URL
          const idMatch = b.url && b.url.match(/\/document\/d\/([^/]+)/);
          const docId = idMatch ? idMatch[1] : null;
          const pdfUrl = docId ? `https://docs.google.com/document/d/${docId}/export?format=pdf` : null;
          const epubUrl = docId ? `https://docs.google.com/document/d/${docId}/export?format=epub` : null;
          return (
            <div key={i} className="story-doc" data-testid={`story-doc-${i}`}>
              <div className="guide-icon"><Icon name="file-lines" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{b.title}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={b.url} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: "none" }} data-testid={`story-doc-open-${i}`}>
                    <Icon name="up-right-from-square" /> Ouvrir
                  </a>
                  {pdfUrl && (
                    <a href={pdfUrl} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: "none" }} data-testid={`story-doc-pdf-${i}`}>
                      <Icon name="file-pdf" /> PDF
                    </a>
                  )}
                  {epubUrl && (
                    <a href={epubUrl} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: "none" }} data-testid={`story-doc-epub-${i}`}>
                      <Icon name="book" /> EPUB
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        }
        if (b.type === "h1" || b.type === "h2") {
          return <h2 key={i} className="story-h2">{b.text}</h2>;
        }
        if (b.type === "h3" || b.type === "h4") {
          return <h3 key={i} id={slugify(b.text)} className="story-h3">{b.text}</h3>;
        }
        return <p key={i} className="story-p"><RichText text={b.text} /></p>;
      })}
    </>
  );
}

function DayNav({ dayId }) {
  const prev = dayId > 1 ? dayId - 1 : null;
  const next = dayId < DAYS.length ? dayId + 1 : null;
  return (
    <div className="day-nav" data-testid="day-nav">
      {prev ? (
        <Link to={`/jour/${prev}`} className="day-nav-btn" data-testid="day-nav-prev">
          <Icon name="arrow-left" /> Jour {prev}
        </Link>
      ) : <span />}
      <Link to="/" className="day-nav-home" data-testid="day-nav-home">
        <Icon name="list" /> Itinéraire
      </Link>
      {next ? (
        <Link to={`/jour/${next}`} className="day-nav-btn" data-testid="day-nav-next">
          Jour {next} <Icon name="arrow-right" />
        </Link>
      ) : <span />}
    </div>
  );
}

function Header() {
  const [openJours, setOpenJours] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (!openJours) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenJours(false);
      }
    };
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [openJours]);

  return (
    <header className="header" data-testid="app-header">
      <Link to="/" className="brand" data-testid="brand-link">
        <Icon name="book-open-reader" /> USA Ouest 2026
      </Link>
      <nav className="nav">
        <div
          className="nav-dropdown"
          ref={dropdownRef}
          onMouseEnter={() => setOpenJours(true)}
          onMouseLeave={() => setOpenJours(false)}
        >
          <NavLink
            to="/"
            end
            data-testid="nav-jours"
            onClick={(e) => {
              e.preventDefault();
              setOpenJours(o => !o);
            }}
          >
            <Icon name="calendar-days" /><span>Jours</span> <Icon name="chevron-down" />
          </NavLink>
          {openJours && (
            <div className="nav-dropdown-menu" data-testid="nav-jours-menu">
              {DAYS.map(d => (
                <Link key={d.id} to={`/jour/${d.id}`} onClick={() => setOpenJours(false)} data-testid={`jours-menu-${d.id}`}>
                  <span className="dropdown-num">J{d.id}</span>
                  <span className="dropdown-date">{d.date}</span>
                  <span className="dropdown-loc">{d.location}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <NavLink to="/carte" data-testid="nav-carte"><Icon name="map" /><span>Carte</span></NavLink>
        <NavLink to="/vols" data-testid="nav-vols"><Icon name="plane" /><span>Vols</span></NavLink>
        <NavLink to="/recherche" data-testid="nav-recherche"><Icon name="magnifying-glass" /><span>Recherche</span></NavLink>
        <NavLink to="/guides" data-testid="nav-guides"><Icon name="book" /><span>Guides</span></NavLink>
      </nav>
    </header>
  );
}

function TripCountdown() {
  // Trip: Day 1 = 28 July 2026, Day 26 = 22 August 2026
  const startDate = new Date(2026, 6, 28); // Month is 0-indexed
  const endDate = new Date(2026, 7, 22);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));
  const diffEnd = Math.floor((today - endDate) / (1000 * 60 * 60 * 24));

  let content;
  if (diffStart > 0) {
    // Before trip
    content = (
      <>
        <div className="countdown-num">J-{diffStart}</div>
        <div>
          <div className="countdown-title">avant le départ</div>
          <div className="countdown-sub">Direction Los Angeles le mardi 28 juillet 2026</div>
        </div>
      </>
    );
  } else if (diffEnd > 0) {
    // After trip
    content = (
      <>
        <div className="countdown-num" style={{ fontSize: 24 }}><Icon name="check-circle" /></div>
        <div>
          <div className="countdown-title">Voyage terminé</div>
          <div className="countdown-sub">Un carnet de souvenirs pour toujours ✨</div>
        </div>
      </>
    );
  } else {
    // During trip
    const dayNum = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    content = (
      <Link to={`/jour/${dayNum}`} className="countdown-during" data-testid="countdown-today-link">
        <div className="countdown-num">J{dayNum}</div>
        <div>
          <div className="countdown-title">aujourd'hui — Jour {dayNum} sur 26</div>
          <div className="countdown-sub">Voir le programme du jour →</div>
        </div>
      </Link>
    );
  }
  return <div className="countdown" data-testid="trip-countdown">{content}</div>;
}

function Home() {
  return (
    <div className="container" data-testid="home-page">
      <div className="hero" data-testid="hero-banner">
        <img src={TRIP.hero} alt="USA Ouest" />
        <div className="hero-overlay">
          <span className="hero-badge"><Icon name="compass" /> Carnet de route</span>
          <h1>{TRIP.title}</h1>
          <p>{TRIP.subtitle}</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-icon"><Icon name="calendar-days" /></div><div><div className="stat-num">{TRIP.totalDays}</div><div className="stat-label">jours d'aventure</div></div></div>
        <div className="stat"><div className="stat-icon"><Icon name="location-dot" /></div><div><div className="stat-num">{TRIP.totalPlaces}</div><div className="stat-label">lieux répertoriés</div></div></div>
      </div>

      <TripCountdown />

      <Link to="/note" className="guide-card" data-testid="note-shortcut">
        <div className="guide-icon"><Icon name="note-sticky" /></div>
        <div style={{ flex: 1 }}>
          <div className="guide-card-title">Note globale du voyage</div>
          <div className="guide-card-sub">Notes partagées, pièces jointes</div>
        </div>
        <Icon name="chevron-right" />
      </Link>

      <Link to="/guides" className="guide-card" data-testid="guides-shortcut">
        <div className="guide-icon"><Icon name="book" /></div>
        <div style={{ flex: 1 }}>
          <div className="guide-card-title">Infos pratiques & guides</div>
          <div className="guide-card-sub">Pass parcs, conduite, paiement, valise…</div>
        </div>
        <Icon name="chevron-right" />
      </Link>

      <Link to="/conseils" className="guide-card" data-testid="conseils-shortcut">
        <div className="guide-icon"><Icon name="star" /></div>
        <div style={{ flex: 1 }}>
          <div className="guide-card-title">À ne pas manquer</div>
          <div className="guide-card-sub">Toutes les activités conseillées, regroupées par jour</div>
        </div>
        <Icon name="chevron-right" />
      </Link>

      <h2 className="section-title"><Icon name="calendar-days" /> L'itinéraire jour par jour</h2>
      {DAYS.map(day => (
        <Link key={day.id} to={`/jour/${day.id}`} className="day-card" data-testid={`day-card-${day.id}`}>
          <div className="day-badge">
            <div className="day-badge-label">Jour</div>
            <div className="day-badge-num">{day.id}</div>
          </div>
          <div className="day-body">
            <div className="day-title">{day.date}</div>
            <div className="day-sub">{day.resume}</div>
            <div className="day-meta-row">
              <div className="day-meta"><Icon name="location-dot" /> {day.places.length} lieux</div>
              {day.reservations && day.reservations.length > 0 && (
                <div className="day-reserved-tag" data-testid={`day-reserved-${day.id}`}>
                  <Icon name="circle-check" /> Réservé
                </div>
              )}
            </div>
          </div>
          <div className="day-arrow"><Icon name="chevron-right" /></div>
        </Link>
      ))}
    </div>
  );
}

function DayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const day = DAYS.find(d => d.id === parseInt(id));
  const [blocks, setBlocks] = React.useState([]);
  const location = useLocation();
  const hash = location.hash;
  React.useEffect(() => {
    if (!day) return;
    let active = true;
    fetchDayBlocks(day.id).then(b => {
      if (!active) return;
      setBlocks(b);
      if (hash) {
        setTimeout(() => {
          const el = document.getElementById(decodeURIComponent(hash.slice(1)));
          if (el) el.scrollIntoView({ block: "start" });
        }, 0);
      }
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hash]);

  if (!day) return <div className="container">Jour introuvable</div>;
  const hasRichContent = blocks.length > 0;

  return (
    <div className="container" data-testid={`day-page-${day.id}`}>
      <button onClick={() => navigate("/")} className="back-link" data-testid="back-to-itineraire">
        <Icon name="arrow-left" /> Itinéraire
      </button>

      <div className="day-hero">
        <div className="day-hero-num">Jour {day.id}</div>
        <h1 className="day-hero-title">{day.date}</h1>
        <div className="day-hero-resume">{day.resume}</div>
      </div>

      {day.reservations && day.reservations.length > 0 && (
        <div className="reservations-box" data-testid="day-reservations">
          <div className="reservations-title"><Icon name="circle-check" /> Réservé</div>
          <ul>
            {day.reservations.map((r, i) => (
              <li key={i}>
                {r.map ? (
                  <a
                    className="reservations-item-name"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.map)}`}
                    target="_blank" rel="noreferrer"
                  >
                    {r.name} <Icon name="location-dot" />
                  </a>
                ) : (
                  <span className="reservations-item-name">{r.name}</span>
                )}
                {r.time && <span className="reservations-item-time">{r.time}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DayTabs day={day} active="recit" />

      <div className="story" data-testid="day-story">
        {hasRichContent ? (
          <RenderBlocks blocks={blocks} />
        ) : (
          <>
            <h3 className="story-h3">{day.location}</h3>
            <p className="story-p" style={{ whiteSpace: "pre-line" }}>{day.story}</p>
          </>
        )}
      </div>

      <DayNav dayId={day.id} />
    </div>
  );
}

function LieuxPage() {
  const { id } = useParams();
  const day = DAYS.find(d => d.id === parseInt(id));
  if (!day) return <div className="container">Jour introuvable</div>;
  const mapsUrl = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place + " " + day.location)}`;
  return (
    <div className="container" data-testid={`lieux-page-${day.id}`}>
      <Link to={`/jour/${day.id}`} className="back-link" data-testid="back-to-day">
        <Icon name="arrow-left" /> Jour {day.id}
      </Link>

      <div className="day-hero">
        <div className="day-hero-num">Jour {day.id} · Lieux</div>
        <h1 className="day-hero-title"><Icon name="location-dot" /> Lieux à découvrir</h1>
        <div className="day-hero-resume">{day.date} — {day.places.length} lieux · {day.location}</div>
      </div>

      <DayTabs day={day} active="lieux" />

      <div className="lieux-grid">
        {day.places.map((place, i) => (
          <a
            key={i}
            href={mapsUrl(place)}
            target="_blank"
            rel="noreferrer"
            className="lieu-card"
            data-testid={`lieu-${i}`}
          >
            <div className="lieu-icon"><Icon name="map-pin" /></div>
            <div className="lieu-body">
              <div className="lieu-name">{place}</div>
              <div className="lieu-sub"><Icon name="map-location-dot" /> Ouvrir dans Google Maps</div>
            </div>
            <Icon name="up-right-from-square" />
          </a>
        ))}
      </div>

      <DayNav dayId={day.id} />
    </div>
  );
}

function HotelPage() {
  const { id } = useParams();
  const day = DAYS.find(d => d.id === parseInt(id));
  if (!day) return <div className="container">Jour introuvable</div>;

  const bookedHotels = hotelsData[String(day.id)] || [];

  return (
    <div className="container" data-testid={`hotel-page-${day.id}`}>
      <Link to={`/jour/${day.id}`} className="back-link" data-testid="back-to-day">
        <Icon name="arrow-left" /> Jour {day.id}
      </Link>

      <div className="day-hero">
        <div className="day-hero-num">Jour {day.id} · Hébergement</div>
        <h1 className="day-hero-title"><Icon name="bed" /> Hôtel</h1>
        <div className="day-hero-resume">{day.date} — {day.location}</div>
      </div>

      <DayTabs day={day} active="hotel" />

      {bookedHotels.length > 0 ? (
        bookedHotels.map((h, hi) => (
          <div key={hi} className="card" data-testid={`hotel-card-${hi}`}>
            <h3>{h.name}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 12px" }}>
              <span className="chip">{h.city}</span>
              {h.families.some(f => f.platform) && (
                <span className="chip">via {[...new Set(h.families.map(f => f.platform).filter(Boolean))].join(" / ")}</span>
              )}
            </div>

            <div className="hotel-families">
              {h.families.map((fam, fi) => (
                <div key={fi} className="hotel-fam-row">
                  <div style={{ flex: 1 }}>
                    <div className="hotel-fam-name"><Icon name="user-group" /> {fam.family || "Famille"}</div>
                    <div className="hotel-fam-meta">{fam.rooms}</div>
                    {fam.notes && <div className="hotel-fam-note">{fam.notes}</div>}
                  </div>
                  <div className="hotel-fam-cost">
                    <div className="hotel-fam-price">{fam.cost_total}</div>
                    {fam.cost_eur && fam.cost_total !== fam.cost_eur + " euros" && (
                      <div className="hotel-fam-eur">≈ {fam.cost_eur} €</div>
                    )}
                    <div className={`hotel-fam-status hotel-status-${fam.status?.toLowerCase().replace(/\s+/g,"-") || "unknown"}`}>
                      {fam.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="address" style={{ marginTop: 14 }}>
              <Icon name="location-dot" />
              <span>{day.hotel?.address || h.city}</span>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + " " + (day.hotel?.address || h.city))}`}
              target="_blank" rel="noreferrer" className="tab active"
              style={{ display: "inline-flex", marginTop: 12 }}
              data-testid={`hotel-map-link-${hi}`}
            >
              <Icon name="map-location-dot" /> Ouvrir dans Google Maps
            </a>
          </div>
        ))
      ) : day.hotel ? (
        <div className="card" data-testid="hotel-card">
          <h3>{day.hotel.name}</h3>
          <span className="chip">Hébergement</span>
          <div className="address"><Icon name="location-dot" /> {day.hotel.address}</div>
          <p style={{ marginTop: 18 }}>Retrouvez votre bon de réservation dans votre dossier voyage.</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.hotel.name + " " + day.hotel.address)}`}
            target="_blank" rel="noreferrer" className="tab active"
            style={{ display: "inline-flex", marginTop: 8 }}
            data-testid="hotel-map-link"
          >
            <Icon name="map-location-dot" /> Ouvrir dans Google Maps
          </a>
        </div>
      ) : (
        <div className="card">
          <p>Pas d'hôtel réservé pour cette nuit (nuit sur la route, camping ou vol de retour).</p>
        </div>
      )}

      <DayNav dayId={day.id} />
    </div>
  );
}

function FlightExtraRow({ icon, label, items, url }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flight-extra-row">
      <div className="flight-extra-icon"><Icon name={icon} /></div>
      <div className="flight-extra-text">
        <div className="flight-extra-label">{label}</div>
        <div className="flight-extra-items">{items.join(" · ")}</div>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="flight-extra-link">Gérer</a>
      )}
    </div>
  );
}

function FlightSegmentDetail({ seg }) {
  return (
    <div className="flight-detail-timeline">
      <div className="flight-detail-point">
        <div className="flight-detail-dot" />
        <div className="flight-detail-line" />
      </div>
      <div className="flight-detail-body">
        <div className="flight-detail-top">
          <div>
            <div className="flight-detail-time">{seg.departure_time}</div>
            <div className="flight-detail-place">{seg.departure_city}, aéroport {seg.departure_airport} ({seg.departure_code})</div>
          </div>
          {seg.status && <span className="flight-status-chip">{seg.status}</span>}
        </div>
        <div className="flight-detail-info">
          {seg.airline && <div>Effectué par {seg.airline}{seg.flight_number ? `, ${seg.flight_number}` : ""}</div>}
          {seg.aircraft && <div>{seg.aircraft}</div>}
          {(seg.duration || seg.class) && (
            <div>{seg.duration ? `Durée: ${seg.duration}` : ""}{seg.duration && seg.class ? " , " : ""}{seg.class || ""}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlightSegmentDetailArrival({ seg }) {
  return (
    <div className="flight-detail-timeline flight-detail-timeline-end">
      <div className="flight-detail-point">
        <div className="flight-detail-dot flight-detail-dot-filled" />
      </div>
      <div className="flight-detail-body">
        <div className="flight-detail-time">{seg.arrival_time}{seg.arrival_offset && <sup className="flight-offset">{seg.arrival_offset}</sup>}</div>
        <div className="flight-detail-place flight-detail-place-strong">{seg.arrival_city}, {seg.arrival_airport}</div>
      </div>
    </div>
  );
}

function FlightTripCard({ trip }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!trip) return null;
  const seg = (trip.segments || [])[0];
  const hasData = seg && (seg.airline || seg.flight_number || seg.departure_code);

  if (!hasData) {
    return <div className="card" data-testid="flight-empty">Détails du vol à compléter.</div>;
  }

  return (
    <div className="card flight-card" data-testid="flight-card">
      <div className="flight-airline">{trip.airline_label || seg.airline}</div>

      <div className="flight-summary-route">
        <div className="flight-endpoint">
          <div className="flight-date">{trip.date}</div>
          <div className="flight-time">{seg.departure_time}</div>
          <div className="flight-code">{seg.departure_code}</div>
        </div>
        <div className="flight-status-wrap">
          {seg.status && <span className="flight-status-chip">{seg.status}</span>}
        </div>
        <div className="flight-endpoint flight-endpoint-arrival">
          <div className="flight-date">{trip.date}</div>
          <div className="flight-time">{seg.arrival_time}{seg.arrival_offset && <sup className="flight-offset">{seg.arrival_offset}</sup>}</div>
          <div className="flight-code">{seg.arrival_code}</div>
        </div>
      </div>

      <button
        type="button"
        className="flight-details-toggle"
        onClick={() => setExpanded(x => !x)}
        data-testid="flight-details-toggle"
      >
        Afficher les détails du vol <Icon name={expanded ? "chevron-up" : "chevron-down"} />
      </button>

      {expanded && (
        <div className="flight-details-expanded">
          <FlightSegmentDetail seg={seg} />
          <FlightSegmentDetailArrival seg={seg} />
          <div className="flight-extras">
            <FlightExtraRow icon="chair" label="Sièges" items={seg.seats} url={seg.seats_url} />
            <FlightExtraRow icon="suitcase" label="Bagages" items={seg.baggage} url={seg.baggage_url} />
            <FlightExtraRow icon="utensils" label="Repas" items={seg.meals} url={seg.meals_url} />
          </div>
        </div>
      )}
    </div>
  );
}

function FlightsPage() {
  const [active, setActive] = React.useState("outbound");
  const trip = flightsData[active];

  return (
    <div className="container" data-testid="flights-page">
      <Link to="/" className="back-link" data-testid="back-to-home">
        <Icon name="arrow-left" /> Accueil
      </Link>

      <div className="day-hero">
        <div className="day-hero-num">Vols</div>
        <h1 className="day-hero-title"><Icon name="plane" /> Vols</h1>
      </div>

      <div className="flight-route-tabs">
        <button
          type="button"
          className={`flight-route-tab${active === "outbound" ? " active" : ""}`}
          onClick={() => setActive("outbound")}
          data-testid="flight-tab-outbound"
        >
          {flightsData.outbound?.route || "Aller"}
        </button>
        <button
          type="button"
          className={`flight-route-tab${active === "return" ? " active" : ""}`}
          onClick={() => setActive("return")}
          data-testid="flight-tab-return"
        >
          {flightsData.return?.route || "Retour"}
        </button>
      </div>

      <FlightTripCard trip={trip} />
    </div>
  );
}

function MangerPage() {
  const { id } = useParams();
  const day = DAYS.find(d => d.id === parseInt(id));
  if (!day) return <div className="container">Jour introuvable</div>;

  return (
    <div className="container" data-testid={`manger-page-${day.id}`}>
      <Link to={`/jour/${day.id}`} className="back-link" data-testid="back-to-day">
        <Icon name="arrow-left" /> Jour {day.id}
      </Link>

      <div className="day-hero">
        <div className="day-hero-num">Jour {day.id} · Restaurants</div>
        <h1 className="day-hero-title"><Icon name="utensils" /> Où Manger</h1>
        <div className="day-hero-resume">{day.date} — {day.restaurants.length} suggestions</div>
      </div>

      <DayTabs day={day} active="manger" />

      {(() => {
        const restos = day.restaurants.filter(r => !isChainRestaurant(r.name));
        if (restos.length === 0) {
          return <div className="card"><p>Pas de suggestion pour ce jour — pique-nique conseillé !</p></div>;
        }
        return restos.map((r, i) => (
          <div key={i} className="card" data-testid={`restaurant-${i}`}>
            <h3>{r.name}</h3>
            <span className="chip">{r.service}</span>
            <p style={{ marginTop: 10 }}>{r.description}</p>
            {r.address && (
              <div className="address" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <span><Icon name="location-dot" /> {r.address}</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + " " + r.address)}`}
                  target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: "none" }}
                  data-testid={`resto-map-${i}`}
                >
                  <Icon name="map-location-dot" /> Google Maps
                </a>
              </div>
            )}
          </div>
        ));
      })()}

      <DayNav dayId={day.id} />
    </div>
  );
}

function NotePage() {
  const { id } = useParams();
  const day = DAYS.find(d => d.id === parseInt(id));
  if (!day) return <div className="container">Jour introuvable</div>;

  return (
    <div className="container" data-testid={`note-page-${day.id}`}>
      <Link to={`/jour/${day.id}`} className="back-link" data-testid="back-to-day">
        <Icon name="arrow-left" /> Jour {day.id}
      </Link>

      <div className="day-hero">
        <div className="day-hero-num">Jour {day.id} · Note</div>
        <h1 className="day-hero-title"><Icon name="note-sticky" /> Note du jour</h1>
        <div className="day-hero-resume">{day.date} — {day.location}</div>
      </div>

      <DayTabs day={day} active="note" />

      <NoteBox scope="day" dayId={day.id} title={`Note du jour ${day.id}`} />

      <DayNav dayId={day.id} />
    </div>
  );
}

function Guides() {
  // Skip the 3 top H1 titles (Carnet de route / Familles / Ouest été 2026) since we already show them elsewhere
  const blocks = (introFull.blocks || []).filter((b, i) => !(i < 3 && b.type === "h1"));
  return (
    <div className="container" data-testid="guides-page">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="book" /> Infos pratiques</h1>
      <p style={{ color: "var(--ink-2)", marginTop: -8, marginBottom: 24 }}>
        Extrait complet du carnet de route original — cartes, circuits, mini-guides et pass parcs.
      </p>
      <div className="story" data-testid="guides-intro">
        <RenderBlocks blocks={blocks} />
      </div>
    </div>
  );
}

function CartePage() {
  const maps = {
    detaillee: { id: "1URVs46aM-gP3LQryvJmRXlj6glpG5KQ", label: "Détaillée" },
    legere: { id: "1fSCDnufJ4glesSev0Wn6fTJCtl6x-z4", label: "Itinéraire (légère)" },
  };
  const [active, setActive] = React.useState("legere");
  const mapId = maps[active].id;
  const openLink = `https://www.google.com/maps/d/viewer?mid=${mapId}`;
  return (
    <div className="container" data-testid="carte-page">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="map" /> Carte interactive</h1>
      <p style={{ color: "var(--ink-2)", marginTop: -8, marginBottom: 20 }}>Tous les lieux du voyage sur Google My Maps.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.entries(maps).map(([key, m]) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`tab${active === key ? " active" : ""}`}
            data-testid={`carte-tab-${key}`}
            style={{ cursor: "pointer", border: "none" }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          title="USA Ouest 2026"
          src={`https://www.google.com/maps/d/embed?mid=${mapId}`}
          width="100%" height="640" style={{ border: 0, display: "block" }}
          data-testid="carte-iframe"
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <a href={openLink} target="_blank" rel="noreferrer" className="tab active" style={{ display: "inline-flex" }} data-testid="carte-open-link">
          <Icon name="up-right-from-square" /> Ouvrir dans Google Maps
        </a>
      </div>
    </div>
  );
}

async function getRecommendations() {
  const rx = /(vivement |fortement |très fortement )?conseill|recommand|impérative|impératif/i;
  const result = [];
  await Promise.all(DAYS.map(async day => {
    const blocks = await fetchDayBlocks(day.id);
    blocks.forEach(b => {
      if (b.type === "h3" && rx.test(b.text) && !/déconseill/i.test(b.text)) {
        result.push({ dayId: day.id, date: day.date, text: b.text, slug: slugify(b.text) });
      }
    });
  }));
  return result;
}

function GlobalNotePage() {
  return (
    <div className="container" data-testid="global-note-page">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="note-sticky" /> Note globale du voyage</h1>
      <p style={{ color: "var(--ink-2)", marginTop: -8, marginBottom: 20 }}>
        Une note partagée avec tout le monde, pour le voyage entier (pense-bête général, pièces jointes).
      </p>
      <NoteBox scope="global" title="Note globale" />
    </div>
  );
}

function RecommendationsPage() {
  const [items, setItems] = React.useState(null);
  React.useEffect(() => {
    let active = true;
    getRecommendations().then(r => { if (active) setItems(r); });
    return () => { active = false; };
  }, []);

  if (items === null) {
    return (
      <div className="container" data-testid="recommandations-page">
        <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="star" /> À ne pas manquer</h1>
        <p style={{ color: "var(--ink-2)" }}>Chargement…</p>
      </div>
    );
  }

  const byDay = {};
  items.forEach(it => {
    if (!byDay[it.dayId]) byDay[it.dayId] = { date: it.date, items: [] };
    byDay[it.dayId].items.push(it);
  });
  const dayIds = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  return (
    <div className="container" data-testid="recommandations-page">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="star" /> À ne pas manquer</h1>
      <p style={{ color: "var(--ink-2)", marginTop: -8, marginBottom: 20 }}>
        Toutes les activités marquées comme conseillées, vivement conseillées ou à réservation impérative, regroupées par jour.
      </p>
      {dayIds.length === 0 && <p>Aucune activité trouvée.</p>}
      {dayIds.map(dayId => (
        <div key={dayId} className="card" style={{ marginBottom: 16, padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="day-badge-num" style={{ fontSize: 18 }}>Jour {dayId}</span>
            <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>— {byDay[dayId].date}</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {byDay[dayId].items.map((it, i) => (
              <li key={i}>
                <Link to={`/jour/${it.dayId}#${it.slug}`} className="chip" style={{ textDecoration: "none", display: "inline-flex" }} data-testid={`reco-item-${it.dayId}-${i}`}>
                  <Icon name="star" /> {it.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function highlight(text, query) {
  if (!query) return text;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function snippetAround(text, query, radius = 60) {
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function SearchPage() {
  const [query, setQuery] = React.useState("");
  const [fullText, setFullText] = React.useState({});
  const [loadingFull, setLoadingFull] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    Promise.all(DAYS.map(async d => ({ id: d.id, blocks: await fetchDayBlocks(d.id) })))
      .then(all => {
        if (!active) return;
        const map = {};
        all.forEach(({ id, blocks }) => { map[id] = blocks; });
        setFullText(map);
        setLoadingFull(false);
      });
    return () => { active = false; };
  }, []);

  const q = query.trim();
  const nq = normalize(q);
  const results = React.useMemo(() => {
    if (nq.length < 2) return [];
    const out = [];
    DAYS.forEach(day => {
      const matches = [];

      if (normalize(day.location).includes(nq)) matches.push({ kind: "Lieu", label: day.location });
      if (normalize(day.resume).includes(nq)) matches.push({ kind: "Résumé", label: snippetAround(day.resume, q) });
      if (day.hotel && normalize(day.hotel.name).includes(nq)) matches.push({ kind: "Hôtel", label: day.hotel.name });
      (day.restaurants || []).forEach(r => {
        if (normalize(r.name).includes(nq) || normalize(r.description || "").includes(nq)) {
          matches.push({ kind: "Restaurant", label: r.name });
        }
      });
      (day.places || []).forEach(p => {
        if (normalize(p).includes(nq)) matches.push({ kind: "Lieu à découvrir", label: p });
      });
      (day.reservations || []).forEach(r => {
        if (normalize(r.name).includes(nq)) matches.push({ kind: "Réservation", label: r.name });
      });
      (fullText[day.id] || []).forEach(b => {
        if ((b.type === "p" || b.type === "h3") && normalize(b.text || "").includes(nq)) {
          matches.push({
            kind: b.type === "h3" ? "Titre" : "Texte",
            label: snippetAround(b.text, q),
            slug: b.type === "h3" ? slugify(b.text) : null,
          });
        }
      });

      if (matches.length > 0) out.push({ day, matches: matches.slice(0, 6) });
    });
    return out;
  }, [nq, fullText, q]);

  return (
    <div className="container" data-testid="search-page">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name="magnifying-glass" /> Recherche</h1>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Chercher un lieu, un hôtel, un restaurant, une activité…"
        className="search-input"
        data-testid="search-input"
      />
      {loadingFull && <p style={{ color: "var(--ink-2)", marginTop: 12 }}>Indexation du contenu en cours…</p>}
      {nq.length >= 2 && !loadingFull && results.length === 0 && (
        <p style={{ color: "var(--ink-2)", marginTop: 16 }}>Aucun résultat pour « {q} ».</p>
      )}
      {nq.length > 0 && nq.length < 2 && (
        <p style={{ color: "var(--ink-2)", marginTop: 16 }}>Continue à taper (2 caractères minimum)…</p>
      )}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {results.map(({ day, matches }) => (
          <div key={day.id} className="card" style={{ padding: 16 }} data-testid={`search-result-day-${day.id}`}>
            <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="day-badge-num" style={{ fontSize: 16 }}>Jour {day.id}</span>
              <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>— {day.date} — {day.location}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {matches.map((m, i) => (
                <li key={i} style={{ fontSize: 14 }}>
                  <Link to={`/jour/${day.id}${m.slug ? `#${m.slug}` : ""}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <span style={{ color: "var(--brand)", fontWeight: 600, marginRight: 6, fontSize: 11, textTransform: "uppercase" }}>{m.kind}</span>
                    <span>{highlight(m.label, q)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Placeholder({ title, icon }) {
  return (
    <div className="container">
      <h1 className="section-title" style={{ fontSize: 32 }}><Icon name={icon} /> {title}</h1>
      <div className="card"><p>Section à venir dans une prochaine mise à jour.</p></div>
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  React.useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) { el.scrollIntoView({ block: "start" }); return; }
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return null;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ScrollToTop />
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jour/:id" element={<DayPage />} />
          <Route path="/jour/:id/lieux" element={<LieuxPage />} />
          <Route path="/jour/:id/hotel" element={<HotelPage />} />
          <Route path="/jour/:id/manger" element={<MangerPage />} />
          <Route path="/jour/:id/note" element={<NotePage />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/conseils" element={<RecommendationsPage />} />
          <Route path="/note" element={<GlobalNotePage />} />
          <Route path="/carte" element={<CartePage />} />
          <Route path="/vols" element={<FlightsPage />} />
          <Route path="/recherche" element={<SearchPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
