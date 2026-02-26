import React from 'react';

interface ArcDialProps {
    value: number; // 0.0 – 1.0
    size?: number;
    onChange?: (value: number) => void;
}

const START_ANGLE = 225; // degrees, bottom-left

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const start = polarToXY(cx, cy, r, endDeg);
    const end = polarToXY(cx, cy, r, startDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function ArcDial({ value, size = 44, onChange }: ArcDialProps) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 5;
    const strokeWidth = 3;

    const sweep = 270;
    const valueDeg = START_ANGLE + value * sweep;

    const trackPath = describeArc(cx, cy, r, START_ANGLE, START_ANGLE + sweep);
    const fillPath = value > 0
        ? describeArc(cx, cy, r, START_ANGLE, Math.min(valueDeg, START_ANGLE + sweep - 0.01))
        : null;

    // Drag interaction
    const dragging = React.useRef(false);
    const lastY = React.useRef(0);
    const currentValue = React.useRef(value);

    React.useEffect(() => {
        currentValue.current = value;
    }, [value]);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!onChange) return;
        dragging.current = true;
        lastY.current = e.clientY;

        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const dy = lastY.current - ev.clientY;
            lastY.current = ev.clientY;
            const delta = dy / 150;
            const next = Math.min(1, Math.max(0, currentValue.current + delta));
            currentValue.current = next;
            onChange(next);
        };

        const onUp = () => {
            dragging.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        e.preventDefault();
    };

    return (
        <svg
            width={size}
            height={size}
            style={{ cursor: onChange ? 'ns-resize' : 'default', display: 'block' }}
            onMouseDown={onMouseDown}
        >
            {/* Track */}
            <path
                d={trackPath}
                fill="none"
                stroke="var(--knob-track)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Fill */}
            {fillPath && (
                <path
                    d={fillPath}
                    fill="none"
                    stroke="var(--knob-fill)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
            )}
        </svg>
    );
}
