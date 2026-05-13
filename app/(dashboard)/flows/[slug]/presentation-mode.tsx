"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sun,
  Moon,
  Maximize2,
  ListChecks,
  MousePointerClick,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Flow, FlowStep } from "@/lib/adapters/supabase/flows";

interface Props {
  flow: Flow;
  steps: FlowStep[];
}

/**
 * Full-screen presentation overlay for a flow. Mirrors the legacy notificaciones-hsbc
 * UI: dot progress header, phone frame with mockup, annotations panel, thumbnail
 * strip at the bottom. Keyboard nav (←/→/Esc) and a dark/light theme toggle.
 *
 * Mockup precedence: `mockupImageUrl` (image) > `mockupHtml` (HTML via
 * dangerouslySetInnerHTML inside the phone frame) > placeholder card.
 *
 * Interactivity: any element inside the HTML mockup carrying
 * `data-action="next"` or `data-action="prev"` (or whose ancestor has it)
 * triggers `onNext()` / `onPrev()` when clicked. Lets the user "click
 * through" the journey using the real-looking buttons inside each screen.
 */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;
const ZOOM_STEP_BUTTON = 0.2;
const ZOOM_STEP_WHEEL = 0.1;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

export function PresentationMode({ flow, steps }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [phoneZoom, setPhoneZoom] = useState(1);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    setCurrent(0);
    setPhoneZoom(1);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(
    () => setCurrent((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const prev = useCallback(() => setCurrent((i) => Math.max(i - 1, 0)), []);

  const zoomIn = useCallback(() => setPhoneZoom((z) => clampZoom(z + ZOOM_STEP_BUTTON)), []);
  const zoomOut = useCallback(() => setPhoneZoom((z) => clampZoom(z - ZOOM_STEP_BUTTON)), []);
  const zoomReset = useCallback(() => setPhoneZoom(1), []);

  // Keyboard nav + zoom shortcuts (+/-/0).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        zoomReset();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, next, prev, close, zoomIn, zoomOut, zoomReset]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Scroll active thumbnail into view.
  useEffect(() => {
    if (!open || !thumbsRef.current) return;
    const active = thumbsRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [current, open]);

  if (steps.length === 0) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-400"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Modo presentación
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-white shadow-sm transition hover:opacity-90"
        style={{ background: flow.accentColor }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Modo presentación
      </button>

      {open && (
        <Overlay
          flow={flow}
          steps={steps}
          current={current}
          setCurrent={setCurrent}
          theme={theme}
          setTheme={setTheme}
          phoneZoom={phoneZoom}
          setPhoneZoom={setPhoneZoom}
          onClose={close}
          onNext={next}
          onPrev={prev}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          thumbsRef={thumbsRef}
        />
      )}
    </>
  );
}

function Overlay({
  flow,
  steps,
  current,
  setCurrent,
  theme,
  setTheme,
  phoneZoom,
  setPhoneZoom,
  onClose,
  onNext,
  onPrev,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  thumbsRef,
}: {
  flow: Flow;
  steps: FlowStep[];
  current: number;
  setCurrent: (i: number) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  phoneZoom: number;
  setPhoneZoom: (z: number | ((prev: number) => number)) => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  thumbsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const step = steps[current];
  if (!step) return null;
  const total = steps.length;

  const isDark = theme === "dark";
  const bgClass = isDark ? "bg-neutral-950" : "bg-neutral-50";
  const fgClass = isDark ? "text-neutral-100" : "text-neutral-900";
  const subFg = isDark ? "text-neutral-400" : "text-neutral-600";
  const panelBg = isDark ? "bg-neutral-900/80" : "bg-white";
  const panelBorder = isDark ? "border-neutral-800" : "border-neutral-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex flex-col ${bgClass} ${fgClass} transition-colors`}
    >
      {/* Header */}
      <header
        className={`flex items-center justify-between gap-4 border-b ${panelBorder} px-6 py-3`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-base font-semibold xl:text-lg">
            Paso {current + 1} de {total}: {step.title}
          </span>
        </div>
        <ProgressDots
          total={total}
          current={current}
          accent={flow.accentColor}
          onClick={setCurrent}
          isDark={isDark}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`rounded-md p-1.5 transition ${
              isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-200"
            }`}
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md p-1.5 transition ${
              isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-200"
            }`}
            aria-label="Cerrar (Esc)"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Phone column — outer wrapper allows panning when zoomed */}
        <div className="relative flex flex-1 flex-col px-4 py-4 md:py-6">
          <div className="flex flex-1 items-center justify-center overflow-auto">
            <PhoneFrame
              step={step}
              accentColor={flow.accentColor}
              zoom={phoneZoom}
              setZoom={setPhoneZoom}
              onNext={onNext}
              onPrev={onPrev}
            />
          </div>

          {/* Phone-column controls: step nav + zoom */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm">
            {/* Step navigation */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrev}
                disabled={current === 0}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark
                    ? "border-neutral-700 hover:bg-neutral-800"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span
                className={`min-w-[70px] text-center text-base font-medium tabular-nums ${subFg}`}
              >
                {current + 1} / {total}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={current === total - 1}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark
                    ? "border-neutral-700 hover:bg-neutral-800"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Zoom controls — only affect the phone, not the rest of the UI */}
            <div
              className={`flex items-center gap-1 rounded-full border px-1 py-1 ${
                isDark ? "border-neutral-700 bg-neutral-900/60" : "border-neutral-300 bg-white"
              }`}
              title="Zoom (+/-/0)"
            >
              <button
                type="button"
                onClick={onZoomOut}
                disabled={phoneZoom <= ZOOM_MIN}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
                }`}
                aria-label="Reducir zoom (−)"
                title="Reducir zoom (−)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onZoomReset}
                className={`min-w-[60px] rounded-full px-2 py-1 text-center text-xs font-medium tabular-nums transition ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
                }`}
                aria-label="Restablecer zoom (0)"
                title="Restablecer zoom (0)"
              >
                {Math.round(phoneZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={onZoomIn}
                disabled={phoneZoom >= ZOOM_MAX}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
                }`}
                aria-label="Aumentar zoom (+)"
                title="Aumentar zoom (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Annotations — responsive width, presentation-sized typography */}
        <aside
          className={`w-[clamp(340px,32vw,560px)] shrink-0 overflow-y-auto border-l ${panelBorder} ${panelBg} px-8 py-8 xl:px-10 xl:py-10`}
        >
          <div
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase xl:text-sm"
            style={{ background: `${flow.accentColor}26`, color: flow.accentColor }}
          >
            Paso {step.position}
          </div>
          <h2 className="mt-4 text-3xl leading-tight font-bold xl:text-4xl">{step.title}</h2>
          {step.description && (
            <p className={`mt-4 text-base leading-relaxed xl:text-lg ${subFg}`}>
              {step.description}
            </p>
          )}
          <div className={`my-6 h-px ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`} />

          {step.keyPoints.length > 0 && (
            <Section icon={<ListChecks className="h-5 w-5" />} title="Puntos clave" isDark={isDark}>
              <ul className="mt-3 space-y-3">
                {step.keyPoints.map((kp, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-base leading-relaxed xl:text-lg"
                  >
                    <span
                      className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: flow.accentColor }}
                    />
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {step.userAction && (
            <Section
              icon={<MousePointerClick className="h-5 w-5" />}
              title="Acción del usuario"
              isDark={isDark}
            >
              <div
                className={`mt-3 rounded-lg border p-4 text-base leading-relaxed xl:text-lg ${
                  isDark ? "border-neutral-700 bg-neutral-900" : "border-neutral-200 bg-neutral-50"
                }`}
              >
                {step.userAction}
              </div>
            </Section>
          )}
        </aside>
      </div>

      {/* Thumbnails */}
      <div
        ref={thumbsRef}
        className={`flex shrink-0 gap-2 overflow-x-auto border-t ${panelBorder} px-4 py-2.5`}
      >
        {steps.map((s, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <button
              key={s.id}
              data-active={active}
              type="button"
              onClick={() => setCurrent(i)}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                active ? "shadow-md" : isDark ? "hover:bg-neutral-800" : "hover:bg-neutral-100"
              }`}
              style={
                active
                  ? {
                      background: `${flow.accentColor}26`,
                      color: flow.accentColor,
                      borderColor: flow.accentColor,
                      borderWidth: 1,
                    }
                  : undefined
              }
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done && !active
                    ? "text-white"
                    : active
                      ? "text-white"
                      : isDark
                        ? "bg-neutral-800 text-neutral-400"
                        : "bg-neutral-200 text-neutral-600"
                }`}
                style={done || active ? { background: flow.accentColor } : undefined}
              >
                {i + 1}
              </span>
              <span className="max-w-[200px] truncate font-medium">{s.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressDots({
  total,
  current,
  accent,
  onClick,
  isDark,
}: {
  total: number;
  current: number;
  accent: string;
  onClick: (i: number) => void;
  isDark: boolean;
}) {
  return (
    <div className="hidden flex-1 items-center justify-center md:flex">
      <div className="flex max-w-[400px] items-center gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onClick(i)}
              className="h-2.5 w-2.5 rounded-full transition hover:scale-125"
              style={{
                background:
                  done || active ? accent : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
              }}
              aria-label={`Ir al paso ${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function PhoneFrame({
  step,
  accentColor,
  zoom,
  setZoom,
  onNext,
  onPrev,
}: {
  step: FlowStep;
  accentColor: string;
  zoom: number;
  setZoom: (z: number | ((prev: number) => number)) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  // Event delegation: any element inside the HTML mockup with
  // `data-action="next"` or `data-action="prev"` (or an ancestor) advances /
  // rewinds the flow. Lets primary CTAs ("Continuar", "Confirmar") behave like
  // real buttons, and back-links ("regresa") go to the previous step.
  function handleMockupClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    const actionEl = target?.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");
    if (action === "next") {
      e.preventDefault();
      onNext();
    } else if (action === "prev") {
      e.preventDefault();
      onPrev();
    }
  }

  // Cmd/Ctrl + wheel over the phone zooms (only affects the phone, not the
  // page). Native React's onWheel is passive, so we attach the listener
  // manually with { passive: false } to be able to preventDefault.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      setZoom((prev) => clampZoom(prev + direction * ZOOM_STEP_WHEEL));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  // Width 375px = iPhone 14/15 logical width. Height clamp keeps the frame
  // inside the viewport on a 768p laptop (~588px usable) and grows on larger
  // displays. The mockup itself scrolls internally when content exceeds the
  // frame. Side buttons + Dynamic Island make it read as a phone, not a
  // browser window.
  return (
    <div
      ref={frameRef}
      className="relative shrink-0 rounded-[2.75rem] border-[8px] border-neutral-900 bg-neutral-900 shadow-2xl ring-1 ring-neutral-700"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "center top",
        transition: "transform 150ms ease",
      }}
    >
      {/* Side buttons (decorative) */}
      {/* Ringer / silent switch (left, near top) */}
      <span
        aria-hidden="true"
        className="absolute top-[88px] -left-[10px] h-7 w-[3px] rounded-l-sm bg-neutral-700"
      />
      {/* Volume up */}
      <span
        aria-hidden="true"
        className="absolute top-[130px] -left-[10px] h-12 w-[3px] rounded-l-sm bg-neutral-700"
      />
      {/* Volume down */}
      <span
        aria-hidden="true"
        className="absolute top-[195px] -left-[10px] h-12 w-[3px] rounded-l-sm bg-neutral-700"
      />
      {/* Power / side button (right) */}
      <span
        aria-hidden="true"
        className="absolute top-[145px] -right-[10px] h-20 w-[3px] rounded-r-sm bg-neutral-700"
      />

      {/* Dynamic Island */}
      <span
        aria-hidden="true"
        className="absolute top-[12px] left-1/2 z-10 h-[28px] w-[110px] -translate-x-1/2 rounded-full bg-neutral-950 shadow-inner"
      />

      <div
        className="flow-mockup-wrap relative w-[375px] overflow-x-hidden overflow-y-auto rounded-[2.1rem] bg-white"
        style={{ height: "clamp(560px, calc(100vh - 200px), 760px)" }}
      >
        {step.mockupImageUrl ? (
          <Image
            src={step.mockupImageUrl}
            alt={step.title}
            width={320}
            height={640}
            className="block h-auto w-full"
            unoptimized
          />
        ) : step.mockupHtml ? (
          <div onClick={handleMockupClick} dangerouslySetInnerHTML={{ __html: step.mockupHtml }} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: accentColor }}
            >
              {step.position}
            </div>
            <div className="text-sm font-semibold text-neutral-800">{step.title}</div>
            <div className="text-xs text-neutral-500">Mockup pendiente de cargar</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="mt-6">
      <div
        className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase xl:text-sm ${
          isDark ? "text-neutral-400" : "text-neutral-500"
        }`}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
