import { useEffect, useRef } from 'react';

/**
 * InteractiveCursorGrid
 * HTML5 Canvas dot-matrix grid with real-time cursor-following illumination.
 * Matches zunaibimtiaz.dev exactly:
 * - Constant 60-120fps buttery smooth performance.
 * - Sharp high-DPI rendering using window.devicePixelRatio.
 * - Passive dots across the entire screen.
 * - Active illuminated emerald dots + ambient glow under/around the cursor.
 */
export default function InteractiveCursorGrid({ isDark }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Mouse coordinates (interpolated via lerp)
    let currentX = -1000;
    let currentY = -1000;
    let targetX = -1000;
    let targetY = -1000;
    let isInside = false;

    // Setup high-DPI canvas
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handlePointerMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isInside) {
        isInside = true;
        if (currentX < -500) {
          currentX = targetX;
          currentY = targetY;
        }
      }
    };

    const handlePointerLeave = () => {
      isInside = false;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave, { passive: true });

    // Rendering loop
    const render = () => {
      // Smooth lerp (18% step per frame)
      if (isInside || currentX > -500) {
        currentX += (targetX - currentX) * 0.18;
        currentY += (targetY - currentY) * 0.18;
      }

      ctx.clearRect(0, 0, width, height);

      const gridSize = 20; // High-density dot matrix spacing (more than 3x more dots!)
      const spotlightRadius = 280; // 280px wide illumination aura
      const spotlightRadiusSq = spotlightRadius * spotlightRadius;

      // 1. Ambient Radial Glow behind the cursor
      if (isInside && currentX > -500) {
        const glowGrad = ctx.createRadialGradient(
          currentX, currentY, 0,
          currentX, currentY, spotlightRadius * 1.2
        );
        if (isDark) {
          glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
          glowGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.02)');
          glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else {
          glowGrad.addColorStop(0, 'rgba(16, 185, 129, 0.06)');
          glowGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.015)');
          glowGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        }

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(currentX, currentY, spotlightRadius * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Colors for passive dots
      // Dark mode: visible crisp zinc dots
      // Light mode: visible crisp slate dots
      const passiveColor = isDark
        ? 'rgba(255, 255, 255, 0.18)'
        : 'rgba(30, 41, 59, 0.28)';

      const baseDotRadius = 1.05;

      // 2. Batch draw passive dots anchored symmetrically to centerX
      ctx.fillStyle = passiveColor;
      ctx.beginPath();

      const activeDots = [];
      const centerX = width / 2;
      const startX = centerX - Math.ceil(centerX / gridSize) * gridSize;

      for (let x = startX; x < width + gridSize; x += gridSize) {
        for (let y = gridSize / 2; y < height; y += gridSize) {
          const dx = x - currentX;
          const dy = y - currentY;
          const distSq = dx * dx + dy * dy;

          if (isInside && distSq < spotlightRadiusSq) {
            // Keep for individual illuminated rendering
            const dist = Math.sqrt(distSq);
            activeDots.push({ x, y, dist });
          } else {
            // Passive dot
            ctx.moveTo(x + baseDotRadius, y);
            ctx.arc(x, y, baseDotRadius, 0, Math.PI * 2);
          }
        }
      }
      ctx.fill();

      // 3. Draw illuminated green dots near cursor
      if (activeDots.length > 0) {
        for (let i = 0; i < activeDots.length; i++) {
          const { x, y, dist } = activeDots[i];
          const intensity = Math.max(0, 1 - dist / spotlightRadius);
          const easeIntensity = intensity * intensity; // quadratic ease for natural falloff

          // Size expands slightly as cursor gets closer
          const r = baseDotRadius + easeIntensity * 1.1;

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);

          if (isDark) {
            // Dark mode: subtle neon emerald (#10b981 / #34d399)
            ctx.fillStyle = `rgba(52, 211, 153, ${0.15 + easeIntensity * 0.40})`;
          } else {
            // Light mode: subtle deep emerald green (#059669)
            ctx.fillStyle = `rgba(5, 150, 105, ${0.15 + easeIntensity * 0.40})`;
          }
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      if (animId) {
        cancelAnimationFrame(animId);
      }
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-25 dark:opacity-20"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
