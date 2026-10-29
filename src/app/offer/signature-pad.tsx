"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const W = 600;
const H = 160;

/**
 * Draw-to-sign canvas on pointer events (mouse, pen and touch alike). The ink
 * colour is read from the canvas's own `color`, so it follows the theme.
 */
export function SignaturePad({
  hasInk,
  onInkChange,
  invalid,
  describedBy,
}: {
  hasInk: boolean;
  onInkChange: (v: boolean) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    ctx.strokeStyle = getComputedStyle(e.currentTarget).color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) onInkChange(true);
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const clear = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, W, H);
    onInkChange(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "relative overflow-hidden rounded-md border bg-card",
          invalid ? "border-destructive" : "border-input",
        )}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          role="img"
          aria-label="Signature area. Draw your signature with a mouse, pen or finger, or tick the option below to sign with your typed name instead."
          aria-describedby={describedBy}
          className="block h-36 w-full cursor-crosshair touch-none text-foreground"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Sign here
          </span>
        )}
        <span className="pointer-events-none absolute bottom-6 left-6 right-6 border-b border-dashed border-border" aria-hidden />
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser />
          Clear
        </Button>
      </div>
    </div>
  );
}
