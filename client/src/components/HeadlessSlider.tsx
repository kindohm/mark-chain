import type React from 'react';
import { useEffect, useRef } from 'react';

interface HeadlessSliderProps {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange?: (value: number) => void;
    ariaLabel: string;
    className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function HeadlessSlider({
    value,
    min = 0,
    max = 127,
    step = 1,
    onChange,
    ariaLabel,
    className = '',
}: HeadlessSliderProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const draggingPointerIdRef = useRef<number | null>(null);
    const currentValueRef = useRef(value);

    useEffect(() => {
        currentValueRef.current = value;
    }, [value]);

    const emit = (next: number) => {
        if (!onChange) return;
        const snapped = clamp(Math.round(next / step) * step, min, max);
        if (snapped === currentValueRef.current) return;
        currentValueRef.current = snapped;
        onChange(snapped);
    };

    const valueToRatio = (next: number) => (clamp(next, min, max) - min) / Math.max(1, max - min);

    const updateFromClientY = (clientY: number) => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        if (!rect.height) return;

        const py = clamp(clientY - rect.top, 0, rect.height);
        const ratio = 1 - py / rect.height;
        emit(min + ratio * (max - min));
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!onChange) return;
        draggingPointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientY(e.clientY);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (draggingPointerIdRef.current !== e.pointerId) return;
        updateFromClientY(e.clientY);
    };

    const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
        if (draggingPointerIdRef.current !== e.pointerId) return;
        draggingPointerIdRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onChange) return;
        const bigStep = step * 8;
        let next = currentValueRef.current;

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next += step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next -= step;
        else if (e.key === 'PageUp') next += bigStep;
        else if (e.key === 'PageDown') next -= bigStep;
        else if (e.key === 'Home') next = min;
        else if (e.key === 'End') next = max;
        else return;

        e.preventDefault();
        emit(next);
    };

    const ratio = valueToRatio(value);
    const pct = ratio * 100;

    return (
        <div
            ref={rootRef}
            className={`headless-slider ${className}`.trim()}
            role="slider"
            aria-label={ariaLabel}
            aria-orientation="vertical"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={clamp(value, min, max)}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onKeyDown={onKeyDown}
        >
            <div className="headless-slider__track" />
            <div className="headless-slider__fill" style={{ height: `${pct}%` }} />
            <div className="headless-slider__thumb" style={{ bottom: `${pct}%` }} />
        </div>
    );
}
