import { useEffect, useRef, useState } from "react";
import type { ChainStepEvent, OscDebugEvent, StateMidiConfig } from "../types";

const EVENT_RAIN_CONFIG = {
  dropHeightPx: 5,
  stepAdvancePx: 5,
  maxDrops: 320,
} as const;

type DropKind = "state" | "stab1" | "stab2";

interface Drop {
  id: number;
  lane: number;
  y: number;
  kind: DropKind;
}

interface EventRainProps {
  numStates: number;
  stateMidi: StateMidiConfig[];
  lastStep: ChainStepEvent | null;
  lastOscDebugEvent: OscDebugEvent | null;
}

export default function EventRain({
  numStates,
  stateMidi,
  lastStep,
  lastOscDebugEvent,
}: EventRainProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nextDropIdRef = useRef(1);
  const lastHandledStepKeyRef = useRef<string | null>(null);
  const lastHandledOscIdRef = useRef<number | null>(null);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const visibleStateIndices = Array.from({ length: Math.max(0, numStates) }, (_, i) => i)
    .filter((stateIndex) => stateMidi[stateIndex]?.deviceName !== "rest");
  const stateLaneByIndex = new Map<number, number>(
    visibleStateIndices.map((stateIndex, laneIndex) => [stateIndex, laneIndex]),
  );
  const laneCount = visibleStateIndices.length + 2;
  const stab1Lane = visibleStateIndices.length;
  const stab2Lane = visibleStateIndices.length + 1;
  const laneSignature = `${numStates}:${visibleStateIndices.join(",")}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDrops([]);
    lastHandledStepKeyRef.current = null;
    lastHandledOscIdRef.current = null;
  }, [laneSignature]);

  useEffect(() => {
    if (!lastStep || laneCount <= 0 || size.height <= 0) return;

    const stepKey = `${lastStep.chainId}:${lastStep.step}:${lastStep.timestamp}`;
    if (lastHandledStepKeyRef.current === stepKey) return;
    lastHandledStepKeyRef.current = stepKey;

    setDrops((prev) => {
      const moved = prev
        .map((drop) => ({ ...drop, y: drop.y + EVENT_RAIN_CONFIG.stepAdvancePx }))
        .filter((drop) => drop.y < size.height);

      const stateLane = stateLaneByIndex.get(lastStep.toState);
      if (stateLane === undefined) {
        return moved.slice(-EVENT_RAIN_CONFIG.maxDrops);
      }

      const next: Drop = {
        id: nextDropIdRef.current++,
        lane: stateLane,
        y: 0,
        kind: "state",
      };

      return [...moved, next].slice(-EVENT_RAIN_CONFIG.maxDrops);
    });
  }, [lastStep, laneCount, size.height, stateLaneByIndex]);

  useEffect(() => {
    if (!lastOscDebugEvent || laneCount <= 0 || size.height <= 0) return;
    if (lastHandledOscIdRef.current === lastOscDebugEvent.id) return;
    lastHandledOscIdRef.current = lastOscDebugEvent.id;

    const lane =
      lastOscDebugEvent.source === "stab1"
        ? stab1Lane
        : lastOscDebugEvent.source === "stab2"
          ? stab2Lane
          : null;

    if (lane === null) return;
    const kind: DropKind =
      lastOscDebugEvent.source === "stab1" ? "stab1" : "stab2";

    setDrops((prev) => {
      const next: Drop = {
        id: nextDropIdRef.current++,
        lane,
        y: 0,
        kind,
      };
      return [...prev, next].slice(-EVENT_RAIN_CONFIG.maxDrops);
    });
  }, [lastOscDebugEvent, laneCount, size.height, stab1Lane, stab2Lane]);

  const laneWidth = laneCount > 0 ? size.width / laneCount : 0;

  return (
    <section className="event-rain" aria-label="Event rain visualization">
      <div className="event-rain__header">
        <span>Event Rain</span>
      </div>
      <div ref={containerRef} className="event-rain__viewport">
        <svg
          className="event-rain__svg"
          viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: Math.max(0, laneCount - 1) }, (_, i) => {
            const x = (i + 1) * laneWidth;
            return (
              <line
                key={`lane-${i}`}
                x1={x}
                y1={0}
                x2={x}
                y2={size.height}
                className="event-rain__lane-line"
              />
            );
          })}

          {drops.map((drop) => {
            const rectWidth = Math.max(1, laneWidth - 1);
            const x = drop.lane * laneWidth + (laneWidth - rectWidth) / 2;
            return (
              <rect
                key={drop.id}
                x={x}
                y={drop.y}
                width={rectWidth}
                height={EVENT_RAIN_CONFIG.dropHeightPx}
                rx={1}
                className={`event-rain__drop event-rain__drop--${drop.kind}`}
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}
