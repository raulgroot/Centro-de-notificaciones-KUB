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
 * `data-action="next"` (or its ancestor) triggers `onNext()` when clicked.
 * Lets the user "click through" the journey using the real-looking buttons
 * inside each screen.
 */
export function PresentationMode({ flow, steps }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const thumbsRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    setCurrent(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(
    () => setCurrent((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const prev = useCallback(() => setCurrent((i) => Math.max(i - 1, 0)), []);

  // Keyboard nav.
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
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, next, prev, close]);

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
          onClose={close}
          onNext={next}
          onPrev={prev}
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
  onClose,
  onNext,
  onPrev,
  thumbsRef,
}: {
  flow: Flow;
  steps: FlowStep[];
  current: number;
  setCurrent: (i: number) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
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
          <span className="truncate text-sm font-semibold">
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
        {/* Phone column */}
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          <div className="flex flex-col items-center gap-4">
            <PhoneFrame step={step} accentColor={flow.accentColor} onNext={onNext} />
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={onPrev}
                disabled={current === 0}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark
                    ? "border-neutral-700 hover:bg-neutral-800"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className={`min-w-[60px] text-center font-medium tabular-nums ${subFg}`}>
                {current + 1} / {total}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={current === total - 1}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isDark
                    ? "border-neutral-700 hover:bg-neutral-800"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
                aria-label="Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Annotations */}
        <aside
          className={`w-[420px] shrink-0 overflow-y-auto border-l ${panelBorder} ${panelBg} px-7 py-8`}
        >
          <div
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase"
            style={{ background: `${flow.accentColor}26`, color: flow.accentColor }}
          >
            Paso {step.position}
          </div>
          <h2 className="mt-3 text-2xl leading-tight font-bold">{step.title}</h2>
          {step.description && (
            <p className={`mt-3 text-sm leading-relaxed ${subFg}`}>{step.description}</p>
          )}
          <div className={`my-5 h-px ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`} />

          {step.keyPoints.length > 0 && (
            <Section icon={<ListChecks className="h-4 w-4" />} title="Puntos clave" isDark={isDark}>
              <ul className="mt-2 space-y-2">
                {step.keyPoints.map((kp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
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
              icon={<MousePointerClick className="h-4 w-4" />}
              title="Acción del usuario"
              isDark={isDark}
            >
              <div
                className={`mt-2 rounded-md border p-3 text-sm leading-relaxed ${
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
        className={`flex shrink-0 gap-2 overflow-x-auto border-t ${panelBorder} px-6 py-3`}
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
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition ${
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
              <span className="max-w-[180px] truncate font-medium">{s.title}</span>
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
  onNext,
}: {
  step: FlowStep;
  accentColor: string;
  onNext: () => void;
}) {
  // Event delegation: any element inside the HTML mockup with
  // `data-action="next"` (or whose ancestor has it) advances the flow.
  // Lets primary CTAs ("Continuar", "Confirmar", etc.) behave like real buttons.
  function handleMockupClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-action="next"]')) {
      e.preventDefault();
      onNext();
    }
  }

  return (
    <div className="rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl">
      <div className="flow-mockup-wrap relative h-[640px] w-[320px] overflow-x-hidden overflow-y-auto rounded-[1.8rem] bg-white">
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
    <div className="mt-4">
      <div
        className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase ${
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
