import { useEffect, useRef } from "react";

interface FftStripProps {
  analyser: AnalyserNode | null;
  active: boolean;
}

export default function FftStrip({ analyser, active }: FftStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      canvas.width = width;
      canvas.height = height;
    };

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let frequencyData: Uint8Array<ArrayBuffer> | null = null;
    const css = getComputedStyle(document.documentElement);
    const primary =
      css.getPropertyValue("--primary").trim() ||
      css.getPropertyValue("--accent").trim() ||
      "#7c6af7";

    const drawIdle = () => {
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(255,255,255,0.08)";
      context.fillRect(0, Math.floor(height / 2), width, 1);
    };

    const draw = () => {
      frame = window.requestAnimationFrame(draw);

      if (!active || !analyser) {
        drawIdle();
        return;
      }

      if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
        frequencyData = new Uint8Array(
          new ArrayBuffer(analyser.frequencyBinCount),
        );
      }

      analyser.getByteFrequencyData(frequencyData);

      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);

      const bars = Math.max(24, Math.floor(width / 5));
      const step = Math.max(1, Math.floor(frequencyData.length / bars));
      const barWidth = width / bars;

      context.fillStyle = primary;

      for (let i = 0; i < bars; i++) {
        const bin = i * step;
        const magnitude = frequencyData[bin] / 255;
        const barHeight = Math.max(1, magnitude * height);
        context.globalAlpha = 0.2 + magnitude * 0.8;
        context.fillRect(i * barWidth, height - barHeight, Math.max(1, barWidth - 1), barHeight);
      }

      context.globalAlpha = 1;
    };

    draw();

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active, analyser]);

  return (
    <div className={`fft-strip ${active ? "fft-strip--active" : ""}`}>
      <canvas ref={canvasRef} className="fft-strip__canvas" aria-label="Audio FFT visualization" />
    </div>
  );
}
